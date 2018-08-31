const fetch = require('node-fetch');
const url = require('url');
const log4js = require('log4js');
const log = log4js.getLogger('rest-api');
log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';

async function postJson(url, accessToken, jsonPayload, responseCode) {
  const options = {
    method: 'POST',
    body: JSON.stringify(jsonPayload),
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  return await makeRequest(url, options, responseCode);
}

async function postForm(url, params, responseCode, accessToken = undefined) {
  const options = {
    method: 'POST',
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    }
  };

  if (accessToken) {
    options.headers.Authorization = `Bearer ${accessToken}`;
  }

  return await makeRequest(url, options, responseCode);
}

async function putForm(url, params, accessToken, responseCode) {
  const options = {
    method: 'PUT',
    body: params,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    }
  };

  return await makeRequest(url, options, responseCode);
}

async function getJson(url, accessToken, responseCode) {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  };

  return await makeRequest(url, options, responseCode);
}

async function makeRequest(url, options, responseCode) {
  log.debug(`Fetching '${url} with '${JSON.stringify(options)}'`)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  let res = await fetch(url, options);
  let response = {
    status: res.status,
    statusText: res.statusText
  };
  if (res.status === responseCode) {
    response.json = await res.json();
  }
  log.debug(`Returning '${JSON.stringify(response)}'`)
  return response;
}

async function del(url, accessToken) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const options = {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  return await fetch(url, options);
}

module.exports.postJson = postJson;
module.exports.postForm = postForm;
module.exports.putForm = putForm;
module.exports.getJson = getJson;
module.exports.delete = del;
