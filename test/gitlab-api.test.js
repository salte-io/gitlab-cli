const api = require('../src/gitlab-api');
const assert = require('assert');
const fs = require('fs');
const nock = require('nock');

describe('The Gitlab API module', () => {
  let groupId;
  let groupName;
  let accessToken;

  before(async function() {
    this.timeout(5000);
    accessToken = await api.getToken(process.env.URL, process.env.USERNAME, process.env.PASSWORD);
    let response = await api.addGroup(process.env.URL, accessToken, 'test/data/groups/test-group.json', 'test/data/permissions/single-role.json');
    groupId = response.id;
    groupName = response.name;
  });

  after(async function() {
    await api.deleteGroup(process.env.URL, accessToken, groupId);
  });

  describe('addGroup function', () => {
    it('should add a new Gitlab group with multiple roles.', async function() {
      this.timeout(5000);
      let response = await api.addGroup(process.env.URL, accessToken, 'test/data/groups/multi-role.json', 'test/data/permissions/multi-role.json');
      assert.ok(response.ldap_group_links && response.ldap_group_links.length === 3);

      if (response) {
        try {
          await api.deleteGroup(process.env.URL, accessToken, response.id);
        } catch(error) {
          log.error(`I was unable to clean-up after myself. You will need to manually cleanup group #${response.id}.`);
        }
      }
    });

    it('should add a new Gitlab group with a single role.', async function() {
      let response = await api.addGroup(process.env.URL, accessToken, 'test/data/groups/single-role.json', 'test/data/permissions/single-role.json');
      assert.ok(response.ldap_group_links && response.ldap_group_links.length === 1);

      if (response) {
        try {
          await api.deleteGroup(process.env.URL, accessToken, response.id);
        } catch(error) {
          log.error(`I was unable to clean-up after myself. You will need to manually cleanup group #${response.id}.`);
        }
      }
    });

    it('should add a new Gitlab group with a no roles.', async function() {
      let response = await api.addGroup(process.env.URL, accessToken, 'test/data/groups/no-role.json', 'test/data/permissions/no-role.json');
      assert.ok(response.ldap_group_links === undefined);

      if (response) {
        try {
          await api.deleteGroup(process.env.URL, accessToken, response.id);
        } catch(error) {
          log.error(`I was unable to clean-up after myself. You will need to manually cleanup group #${response.id}.`);
        }
      }
    });

    it('should throw an error while trying to add a new group', async () => {
      nock(process.env.URL, { allowUnmocked: true }).get('/api/v4/groups').query({ search: 'Test-Group' }).reply(404);
      nock(process.env.URL, { allowUnmocked: true }).post('/api/v4/groups').reply(400);

      const target = async () => {
        await api.addGroup(process.env.URL, accessToken, 'test/data/groups/test-group.json', 'test/data/permissions/multi-role.json');
      };

      await assertThrowsAsync(target, /groups endpoint didn't return a JSON payload/);
      nock.cleanAll();
    });

    it('should throw an error while trying to link the AD group.', async function() {
      nock(process.env.URL, {allowUnmocked: true}).post(`/api/v4/groups/${groupId}/ldap_group_links`).reply(400);

      const target = async () => {
        await api.addGroup(process.env.URL, accessToken, 'test/data/groups/test-group.json', 'test/data/permissions/multi-role.json');
      };

      await assertThrowsAsync(target, /error was encountered while trying to add the link/);
      nock.cleanAll();
    });
  });

  describe('getGroup function', () => {
    it('should return an existing Gitlab group.', async function() {
      let contents = JSON.parse(fs.readFileSync('test/data/groups/test-group.json', 'utf8'));

      let response = await api.getGroup(process.env.URL, accessToken, contents.name);
      assert.ok(response && response.id === groupId);
    });

    it('should throw an error', async () => {
      nock(process.env.URL).get('/api/v4/groups/1234').reply(404);

      const target = async () => {
        await api.getGroup(process.env.URL, accessToken, 1234);
      };

      await assertThrowsAsync(target, /get groups endpoint didn't return a JSON payload/);
      nock.cleanAll();
    });
  });

  describe('searchGroup function', () => {
    it('should return the previously created test group.', async () => {
      let response = await api.searchGroup(process.env.URL, accessToken, groupName);
      assert.ok(response.length === 1 && response[0].id === groupId);
    });

    it('should throw an error.', async function() {
      nock(process.env.URL).get('/api/v4/groups').query({search: 'bogus'}).reply(500);

      const target = async () => {
        await api.searchGroup(process.env.URL, accessToken, 'bogus');
      };

      await assertThrowsAsync(target, /500/);
      nock.cleanAll();
    });
  });

  describe('deleteGroup function', () => {
    it('should throw an error', async () => {
      nock(process.env.URL).delete('/api/v4/groups/1234').reply(404);

      const target = async () => {
        await api.deleteGroup(process.env.URL,  accessToken, 1234);
      };

      await assertThrowsAsync(target, /delete group endpoint didn't return the expected status code/);
      nock.cleanAll();
    });
  });

  describe('getToken function', () => {
    it('should throw an error.', async () => {
      nock(process.env.URL, { allowUnmocked: true }).post('/oauth/token').reply(400);

      const target = async () => {
        await api.getToken(process.env.URL, 'username', 'password');
      };

      await assertThrowsAsync(target, /token endpoint didn't return an access token/);
      nock.cleanAll();
    });
  });

  describe('applyLicense function', () => {
    it('should return a JSON payload.', async () => {
      let response = await api.applyLicense(process.env.URL, accessToken, process.env.GITLAB_LICENSE);
      assert.ok(response);
    });

    it('should throw an error', async () => {
      nock(process.env.URL).post('/api/v4/license').reply(400);

      // Try/Catch Required in Case Error Doesn't Match Regular Expression
      try {
        await assertThrowsAsync(async () => { await api.applyLicense(process.env.URL, accessToken, process.env.GITLAB_LICENSE); }, /license endpoint didn't return a JSON payload/);
      } finally {
        nock.cleanAll();
      }
    });
  });

  describe('disableSignup function', () => {
    it('should return a JSON payload.', async () => {
      let response = await api.disableSignup(process.env.URL, accessToken);
      assert.ok(response);
    });

    it('should throw an error', async () => {
      nock(process.env.URL).put('/api/v4/application/settings').reply(400);

      // Try/Catch Required in Case Error Doesn't Match Regular Expression
      try {
        await assertThrowsAsync(async () => { await api.disableSignup(process.env.URL, accessToken); }, /settings endpoint didn't return a JSON payload/);
      } finally {
        nock.cleanAll();
      }
    });
  });
});

async function assertThrowsAsync(fn, regExp) {
  let f = () => {};
  try {
    await fn();
  } catch(e) {
    f = () => {throw e};
  } finally {
    assert.throws(f, regExp);
  }
}
