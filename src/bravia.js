'use strict';

const SsdpClient = require('node-ssdp').Client;
const Request = require('request');
const URL = require('url');
const parser = require('xml2json');
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

class Bravia {
  constructor(host, port = 80, psk = '0000', timeout = 5000) {
    this.host = host;
    this.port = port;
    this.psk = psk;
    this.timeout = timeout;
    this.protocols = SERVICE_PROTOCOLS;

    for (let key in this.protocols) {
      let endpoint = this.protocols[key];
      this[endpoint] = new ServiceProtocol(this, endpoint);
    }

    this._url = `http://${this.host}:${this.port}/sony`;
  }

  static discover(timeout = 3000) {
    return new Promise((resolve, reject) => {
      let ssdp = new SsdpClient();
      let discovered = [];

      ssdp.on('response', (headers, statusCode) => {
        if (statusCode === 200) {
          Request.get(headers.LOCATION, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              let result = parser.toJson(body, { object: true });
              let device = result.root.device;

              let service = device.serviceList.service
                .find(service => service.serviceType === SSDP_SERVICE_TYPE);

              if (service) {
                let api = URL.parse(service.controlURL);
                discovered.push({
                  host: api.host,
                  port: (api.port || 80),
                  friendlyName: device.friendlyName,
                  manufacturer: device.manufacturer,
                  manufacturerURL: device.manufacturerURL,
                  modelName: device.modelName,
                  UDN: device.UDN
                });
              }
            }
          });
        }
      });

      ssdp.search(SSDP_SERVICE_TYPE);

      let timer = setTimeout(() => {
        ssdp.stop();

        if (discovered.length > 0) {
          resolve(discovered);
          return;
        }

        reject(new Error('No bravia devices discovered.'));
      }, timeout);
    });
  }

  send(ircc) {
    let body = `<?xml version="1.0"?>
        <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
            <s:Body>
                <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
                    <IRCCCode>${ircc}</IRCCCode>
                </u:X_SendIRCC>
            </s:Body>
        </s:Envelope>`;

    return this._request({
      path: '/IRCC',
      body: body
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
          reject((error ? error : new Error(body.error[1])));
        }
      });
    });
  }
}

module.exports = Bravia;
