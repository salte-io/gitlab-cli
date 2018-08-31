const log4js = require('log4js');
const fs = require('fs');
const url = require('url');
const rest = require('./rest-api');
const querystring = require('querystring');

const log = log4js.getLogger('gitlab-api');
log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';

async function getToken(baseUrl, username, password) {
  const params = new url.URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);

  let response = await rest.postForm(`${baseUrl}/oauth/token`, params, 200);
  if (response.json && response.json.access_token && response.json.access_token.match(/[a-z0-9]{64}/)) {
    return response.json.access_token;
  } else {
    throw new Error(`The token endpoint didn't return an access token. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
  }
}

async function addGroup(baseUrl, accessToken, groupDefinitionFile, permissionsDefinitionFile) {
  const groupDefinition = JSON.parse(fs.readFileSync(groupDefinitionFile, 'utf8'));
  log.debug(`Received Request to Add Group '${groupDefinition.name}'`);
  const permissionsDefinition = JSON.parse(fs.readFileSync(permissionsDefinitionFile, 'utf8'));

  // Search for the Specified Group
  const params = {
    search: groupDefinition.name
  };
  let group;
  let response = await rest.getJson(`${baseUrl}/api/v4/groups?${querystring.stringify(params)}`, accessToken, 200);
  let count = 0;
  if (response.json) {
    response.json.forEach((item) => {
      if (item.path === groupDefinition.path) {
        group = item;
        count++;
      }
    });
  }

  // Create the specified group if it doesn't already exist.
  if (count === 1) {
    log.debug(`The Group '${groupDefinition.name}' Already Exists`);
  } else {
    log.debug(`Creating Group '${groupDefinition.name}'`);
    response = await rest.postJson(`${baseUrl}/api/v4/groups`, accessToken, groupDefinition, 201);
    if (response.json) {
      group = response.json;
    } else {
      throw new Error(`The groups endpoint didn't return a JSON payload. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
    }
  }

  // Iterate through AD groups for each Gitlab permission level associated with
  // this group and link them if they don't already exist.
  log.debug('===============================================================================');
  log.debug(`Iterating through AD groups for each Gitlab permission level associated with Group '${groupDefinition.name}'.`);
  log.debug('===============================================================================');
  for (let x = 0; x < permissionsDefinition.length; x++) {
    let desiredPermission = permissionsDefinition[x];

    if (desiredPermission.activeDirectoryGroups) {
      log.debug(`Adding AD Group Links for the Gitlab Role Level ${desiredPermission.gitlabRoleLevel}.`)
      for (let y = 0; y < desiredPermission.activeDirectoryGroups.length; y++) {
        let desiredGroup = desiredPermission.activeDirectoryGroups[y];

        let found = false;
        if (group.ldap_group_links) {
          for (let z = 0; z < group.ldap_group_links.length; z++) {
            let existingLink = group.ldap_group_links[z];

            if (existingLink.cn === desiredGroup) {
              found = true;
              break;
            }
          }
        }

        if (found) {
          log.debug(`Link for AD Group '${desiredGroup}' Already Exists`);
        }
        else {
          const params = new url.URLSearchParams();
          params.append('cn', desiredGroup);
          params.append('group_access', desiredPermission.gitlabRoleLevel);
          params.append('provider', 'ldapmain');
          response = await rest.postForm(`${baseUrl}/api/v4/groups/${group.id}/ldap_group_links`, params, 201, accessToken);
          if (response.json) {
            log.debug(`Successfully Added Link for AD Group '${desiredGroup}'`);
          } else {
            log.debug(`Error Adding Link for AD Group '${desiredGroup}'`);
            throw new Error(`An error was encountered while trying to add the link for AD Group '${desiredGroup}'. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
          }
        }
      }
      log.debug(`Finished Adding AD Group Links for the Gitlab Role Level ${desiredPermission.gitlabRoleLevel}.`)
    } else {
      log.debug(`No Active Directory Groups Defined for the Gitlab Role Level ${desiredPermission.gitlabRoleLevel}.`)
    }

  }
  log.debug(`Finished Iterating through AD groups for each Gitlab permission level associated with Group '${groupDefinition.name}'.`);

  return await getGroup(baseUrl, accessToken, group.id);
}

async function searchGroup(baseUrl, accessToken, groupName) {
  const params = {
    search: groupName
  };
  // 200 and an empty array are returned if no groups match the specified criterion.
  const response = await rest.getJson(`${baseUrl}/api/v4/groups?${querystring.stringify(params)}`, accessToken, 200);
  if (response.json) {
    return response.json;
  } else {
    throw new Error(`The search groups endpoint didn't return a JSON payload. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
  }
}

async function getGroup(baseUrl, accessToken, groupId) {
  const response = await rest.getJson(`${baseUrl}/api/v4/groups/${groupId}`, accessToken, 200);
  if (response.json) {
    return response.json;
  } else {
    throw new Error(`The get groups endpoint didn't return a JSON payload. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
  }
}

async function deleteGroup(baseUrl, accessToken, groupId) {
  const response = await rest.delete(`${baseUrl}/api/v4/groups/${groupId}`, accessToken);
  if (response.status !== 202) {
    throw new Error(`The delete group endpoint didn't return the expected status code. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
  }
}

async function applyLicense(baseUrl, accessToken, licenseKey) {
  const params = new url.URLSearchParams();
  params.append('license', licenseKey);
  let response = await rest.postForm(`${baseUrl}/api/v4/license`, params, 201, accessToken);
  if (response.json) {
    return response.json;
  } else {
    throw new Error(`The license endpoint didn't return a JSON payload. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
  }
}

async function updateAppSettings(baseUrl, accessToken, params) {
  let response = await rest.putForm(`${baseUrl}/api/v4/application/settings`, params, accessToken, 200);
  if (response.json) {
    return response.json;
  } else {
    throw new Error(`The settings endpoint didn't return a JSON payload. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
  }
}

async function disableSignup(baseUrl, accessToken) {
  const params = new url.URLSearchParams();
  params.append('signup_enabled', false);
  return await updateAppSettings(baseUrl, accessToken, params);
}

module.exports.getToken = getToken;
module.exports.addGroup = addGroup;
module.exports.getGroup = getGroup;
module.exports.deleteGroup = deleteGroup;
module.exports.searchGroup = searchGroup;
module.exports.applyLicense = applyLicense;
module.exports.disableSignup = disableSignup;
