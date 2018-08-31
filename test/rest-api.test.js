const api = require('../src/rest-api');
const assert = require('assert');
const url = require('url');
const log4js = require('log4js');
const log = log4js.getLogger('gitlab-api');
log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';

describe('The REST API module', () => {
  let accessToken;
  let groupId;

  before(async function() {
    this.timeout(5000);

    const params = new url.URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'root');
    params.append('password', 'Summer69');

    let tokenResponse = await api.postForm('https://devops.alpha-salte.io/oauth/token', params, 200);
    if (tokenResponse.json && tokenResponse.json.access_token && tokenResponse.json.access_token.match(/[a-z0-9]{64}/)) {
      accessToken = tokenResponse.json.access_token;
    } else {
      throw new Error(`The token endpoint didn't return an access token. The status code returned was ${tokenResponse.status} and the status text returned was '${tokenResponse.statusText}'.`);
    }

    const uniqueValue = new Date().getTime();
    const group = {
      name: uniqueValue,
      path: uniqueValue,
      description: `Description for ${uniqueValue}`,
      visibility: 'private'
    };

    let groupAddResponse = await api.postJson('https://devops.alpha-salte.io/api/v4/groups', accessToken, group, 201);
    if (groupAddResponse.json && groupAddResponse.json.id) {
      groupId = groupAddResponse.json.id;
    } else {
      throw new Error(`The groups endpoint didn't return a payload. The status code returned was ${groupAddResponse.status} and the status text returned was '${groupAddResponse.statusText}'.`);
    }
  });

  after(async function() {
    let response = await api.delete(`https://devops.alpha-salte.io/api/v4/groups/${groupId}`, accessToken);
    if (response.status !== 202) {
      throw new Error(`The delete group endpoint didn't return the expected status code. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
    }
  });

  describe('postForm function', () => {
    it('should return a valid access token.', async function() {
      const params = new url.URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', 'root');
      params.append('password', 'Summer69');

      let response = await api.postForm('https://devops.alpha-salte.io/oauth/token', params, 200);
      assert.ok(response.json && response.json.access_token && response.json.access_token.match(/[a-z0-9]{64}/));
    });

    it('should return an unauthorized exception.', async function() {
      const params = new url.URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', 'root');
      params.append('password', 'bogus');

      let response = await api.postForm('https://devops.alpha-salte.io/oauth/token', params, 200);
      assert.ok(!response.json && response.status === 401);
    });

    it('should add permissions to an existing Gitlab group.', async function() {
      const params = new url.URLSearchParams();
      params.append('cn', new Date().getTime());
      params.append('group_access', 50);
      params.append('provider', 'ldapmain');

      let response = await api.postForm(`https://devops.alpha-salte.io/api/v4/groups/${groupId}/ldap_group_links`, params, 201, accessToken);
      assert.ok(response.json && response.status === 201);
    });
  });

  describe('postJson function', () => {
    it('should add a new Gitlab group.', async function() {
      this.timeout(5000);

      const uniqueValue = new Date().getTime();
      const group = {
        name: uniqueValue,
        path: uniqueValue,
        description: `Description for ${uniqueValue}`,
        visibility: 'private'
      };

      let response = await api.postJson('https://devops.alpha-salte.io/api/v4/groups', accessToken, group, 201);
      assert.ok(response.json);

      if (response.json) {
        assert.ok(true);
        try {
          response = await api.delete(`https://devops.alpha-salte.io/api/v4/groups/${response.json.id}`, accessToken);
        } catch(error) {
          log.error(`I was unable to clean-up after myself. You will need to manually cleanup group #${response.json.id}. The status code returned was ${response.status} and the status text returned was '${response.statusText}'.`);
        }
      } else {
        assert.ok(false);
      }
    });
  });

  describe('getJson function', () => {
    it('should return an existing Gitlab group.', async function() {
      let response = await api.getJson(`https://devops.alpha-salte.io/api/v4/groups/${groupId}`, accessToken, 200);
      assert.ok(response.json && response.status === 200);
    });
  });
});
