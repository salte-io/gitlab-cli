const fs = require('fs');
const api = require('./gitlab-api');

module.exports.getFilelist = (path) => {
  return fs.readdirSync(path, 'utf8');
};

module.exports.run = async (baseUrl, username, password, gitlabLicense, groupsPath, permissionsPath) => {
  const accessToken = await api.getToken(baseUrl, username, password);
  await api.applyLicense(baseUrl, accessToken, gitlabLicense);
  await api.disableSignup(baseUrl, accessToken);
  const groups = module.exports.getFilelist(groupsPath);
  groups.forEach(async (group) => {
    await api.addGroup(baseUrl, accessToken, `${groupsPath}/${group}`, `${permissionsPath}/${group}`);
  });
};
