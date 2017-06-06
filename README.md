# Sony BRAVIA

Node.js module for discovering and controlling Sony BRAVIA Android TVs. This module allows you retrieve all the available service protocol API methods and invoke any of them.

## Setup

### TV Setup

* Turn on your TV
* On the TV go to Settings > Network > Home network setup > Remote device/Renderer > On
* On the TV go to Settings > Network > Home network setup > IP Control > Authentication > Normal and Pre-Shared Key
* On the TV go to Settings > Network > Home network setup > Remote device/Renderer > Enter Pre-Shared Key > 0000 (or whatever you want your PSK Key to be)
* On the TV go to Settings > Network > Home network setup > Remote device/Renderer > Simple IP Control > On

### Install with NPM

``` npm install bravia --save ```

## Usage

All methods return a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise).

### Discovery

```javascript

const Bravia = require('bravia');

// The time in milliseconds for the bravia discovery to scan for.
let timeout = 5000;

// Attempts to discover any Sony Bravia TVs.
Bravia.discover(timeout)
  .then(devices => {
    for (let device in devices) {
      console.log(device);
    }
  })
  .catch(error => console.error(error));
```

### Service Protocol APIs

```javascript

const Bravia = require('bravia');

// Connects to a Bravia TV at 192.168.1.2:80 with the PSK 0000.
let bravia = new Bravia('192.168.1.2', '80', '0000');

// Retrieves all the system method type versions.
bravia.system.getVersions()
  .then(versions => console.log(versions))
  .catch(error => console.error(error));

// Retrieves all the system method types and versions.
bravia.system.getMethodTypes()
  .then(methods => console.log(methods))
  .catch(error => console.error(error));

// Retrieves all the available IRCC commands from the TV.
bravia.system.invoke('getRemoteControllerInfo')
  .then(commands => console.log(commands))
  .catch(error => console.error(error));

// Queries the volume info.
bravia.audio.invoke('getVolumeInformation')
  .then(info => console.log(info))
  .catch(error => console.error(error));

// Sets the speaker volume level to 50%.
bravia.audio.invoke('setAudioVolume', '1.0', { target: 'speaker', volume: '50' });
```

### Send IRCC Code

```javascript

const Bravia = require('bravia');

// Connects to a Bravia TV at 192.168.1.2:80 with the PSK 0000.
let bravia = new Bravia('192.168.1.2', '80', '0000');

// Retrieves all the available IRCC commands from the TV.
bravia.getIRCCCodes()
  .then(commands => console.log(commands))
  .catch(error => console.error(error));

// Sends an IRCC code signal by name.
bravia.send('Mute');

// Sends an IRCC code signal by value.
bravia.send('AAAAAQAAAAEAAAAUAw==');

// Sends multiple IRCC code signals by name and/or value. Change bravia.delay to alter time between each command sent.
bravia.send(['Hdmi1', 'AAAAAgAAABoAAABaAw==', 'Hdmi2', 'AAAAAgAAABoAAABbAw==']);
```
