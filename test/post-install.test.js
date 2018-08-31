const assert = require('assert');
const postInstall = require('../src/post-install');

describe('The Post Install Module', () => {
  describe('getFilelist function', () => {
    it('should return the list of group files to be applied post install', () => {
      const filelist = postInstall.getFilelist('../groups/');
      assert.equal(filelist.length, 7);
    });
  });

  describe('run function', () => {
    it.only('should complete successfully', async () => {
      await postInstall.run(process.env.URL, process.env.USERNAME, process.env.PASSWORD, process.env.GITLAB_LICENSE, 'test/data/groups', 'test/data/permissions');
    });
  });
});
