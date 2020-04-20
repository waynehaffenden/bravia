'use strict';

const SsdpClient = require('node-ssdp').Client;
const Request = require('request');
const URL = require('url');
const parseString = require('xml2js').parseString;

const ServiceProtocol = require('./service-protocol');

const SSDP_SERVICE_TYPE = 'urn:schemas-sony-com:service:IRCC:1';
const SERVICE_PROTOCOLS = [
  'accessControl',
  'appControl',
  'audio',
  'avContent',
  'browser',
  'cec',
  'encryption',
  'guide',
  'recording',
  'system',
  'videoScreen'
];
const DEFAULT_TIME_BETWEEN_COMMANDS = 350;

class Bravia {
  constructor(host, port = 80, psk = '0000', timeout = 5000) {
    this.host = host;
    this.port = port;
    this.psk = psk;
    this.timeout = timeout;
    this.protocols = SERVICE_PROTOCOLS;
    this.delay = DEFAULT_TIME_BETWEEN_COMMANDS;

    for (let key in this.protocols) {
      let protocol = this.protocols[key];
      this[protocol] = new ServiceProtocol(this, protocol);
    }

    this._url = `http://${this.host}:${this.port}/sony`;
    this._codes = [];
  }

  static discover(timeout = 3000) {
    return new Promise((resolve, reject) => {
      let ssdp = new SsdpClient();
      let discovered = [];

      ssdp.on('response', (headers, statusCode, data) => {
        if (statusCode === 200) {
          Request.get(headers.LOCATION, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              parseString(body, (err, result) => {
                if (!err) {
                  try {
                    let device = result.root.device[0];
                    if (!device.serviceList) {  // Not all devices return a serviceList (e.g. Philips Hue gateway responds without serviceList)
                      return;
                    }
                    let service = device.serviceList[0].service
                      .find(service => service.serviceType[0] === SSDP_SERVICE_TYPE);

                    let api = URL.parse(service.controlURL[0]);
                    discovered.push({
                      host: api.host,
                      port: (api.port || 80),
                      friendlyName: device.friendlyName[0],
                      manufacturer: device.manufacturer[0],
                      manufacturerURL: device.manufacturerURL[0],
                      modelName: device.modelName[0],
                      UDN: device.UDN[0]
                    });
                  } catch(e) {
                    failed(new Error(`Unexpected or malformed discovery response: ${result}.`));
                  }
                } else {
                  failed(new Error(`Failed to parse the discovery response: ${body}.`));
                }
              });
            } else {
              failed(new Error(`Error retrieving the description metadata for device ${data.address}.`));
            }
          });
        }
      });

      ssdp.search(SSDP_SERVICE_TYPE);

      let failed = error => {
        ssdp.stop();
        clearTimeout(timer);
        reject(error);
      };

      let timer = setTimeout(() => {
        ssdp.stop();
        resolve(discovered);
      }, timeout);
    });
  }

  getIRCCCodes() {
    return new Promise((resolve, reject) => {
      if (this._codes.length > 0) {
        resolve(this._codes);
        return;
      }

      this.system
          .invoke('getRemoteControllerInfo')
          .then(codes => {
            this._codes = codes;
            resolve(this._codes);
          }, reject);
    });
  }

  send(codes) {
    return new Promise((resolve, reject) => {
      if (typeof codes === 'string') {
        codes = [codes];
      }

      let index = 0;
      let next = () => {
        if (index < codes.length) {
          let code = codes[index++];
          if (/^[A]{5}[a-zA-Z0-9]{13}[\=]{2}$/.test(code)) {
            send(code);
          } else {
            this.getIRCCCodes()
                .then(response => {
                  let ircc = response.find(ircc => ircc.name === code);
                  if (!ircc) {
                    reject(new Error(`Unknown IRCC code ${code}.`));
                    return;
                  }

                  send(ircc.value);
                }, reject);
          }
        } else {
          resolve();
        }
      };

      let send = code => {
        let body = `<?xml version="1.0"?>
          <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
              <s:Body>
                  <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
                      <IRCCCode>${code}</IRCCCode>
                  </u:X_SendIRCC>
              </s:Body>
          </s:Envelope>`;

        this._request({
          path: '/IRCC',
          body: body
        }).then(() => setTimeout(() => next(), this.delay), reject);
      };

      next();
    });
  }

  _request(options) {
    return new Promise((resolve, reject) => {
      options.timeout = this.timeout;
      options.url = this._url + options.path;
      options.headers = {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
        'X-Auth-PSK': this.psk
      };

      Request.post(options, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          resolve(body);
        } else {
          if (error) {
            reject(error);
          } else if (response.statusCode != 200){
            reject(new Error(`Response error, status code: ${response.statusCode}.`))
          } else if (body.error) {
            reject(new Error(body.error[1]));
          } else {
            parseString(body, (err, result) => {
              if (!err) {
                try {
                  reject(new Error(result['s:Envelope']['s:Body'][0]['s:Fault'][0]['detail'][0]['UPnPError'][0]['errorDescription'][0]));
                } catch (e) {
                  reject(new Error(`Unexpected or malformed error response: ${result}.`));
                }
              } else {
                reject(new Error(`Failed to parse the error response: ${body}.`));
              }
            });
          }
        }
      });
    });
  }
}

module.exports = Bravia;
