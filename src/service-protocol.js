'use strict';

class ServiceProtocol {
  constructor(bravia, endpoint) {
    this.bravia = bravia;
    this.endpoint = endpoint;
    this._methods = {};
  }

  getVersions() {
    return this.invoke('getVersions');
  }

  getMethodTypes() {
    return new Promise((resolve, reject) => {
      if (Object.keys(this._methods).length > 0) {
        resolve(this._methods);
        return;
      }

      this.getVersions().then(versions => {
        let index = 0;
        let next = (results) => {
          if (results) {
            this._methods[versions[index - 1]] = results;
          }

          if (index < versions.length) {
            this.invoke('getMethodTypes', '1.0', versions[index++]).then(next, reject);
          } else {
            resolve(this._methods);
          }
        };

        next();
      }, reject);
    });
  }

  invoke(method, version = '1.0', params) {
    return new Promise((resolve, reject) => {
      params = params ? [params] : [];
      this.bravia._request({
        path: `/${this.endpoint}`,
        json: {
          id: 3,
          method: method,
          version: version,
          params: params
        }
      }).then(response => {
        if (response.error) {
          reject(response.error);
          return;
        }

        if (response.results) {
          resolve(response.results);
        } else if (response.result) {
          resolve(response.result[(response.result.length > 1 ? 1 : 0)]);
        } else {
          resolve();
        }
      }, reject);
    });
  }
}

module.exports = ServiceProtocol;
