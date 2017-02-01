'use strict';

class ServiceProtocol {
  constructor(bravia, protocol) {
    this.bravia = bravia;
    this.protocol = protocol;
    this._methods = [];
  }

  getVersions() {
    return this.invoke('getVersions');
  }

  getMethodTypes(version) {
    return new Promise((resolve, reject) => {
      if (this._methods.length > 0) {
        if (version) {
          resolve(this._methods.find(method => method.version === version));
        } else {
          resolve(this._methods);
        }
        return;
      }

      this.getVersions().then(versions => {
        let index = 0;
        let next = (results) => {
          if (results) {
            this._methods.push({ version: versions[index - 1], methods: results });
          }

          if (index < versions.length) {
            this.invoke('getMethodTypes', '1.0', versions[index++]).then(next, reject);
          } else {
            if (version) {
              resolve(this._methods.find(method => method.version === version));
            } else {
              resolve(this._methods);
            }
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
        path: `/${this.protocol}`,
        json: {
          id: 3,
          method: method,
          version: version,
          params: params
        }
      }).then(response => {
        if (response.error) {
          reject(new Error(response.error[1]));
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
