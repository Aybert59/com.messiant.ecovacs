// based on https://github.com/mrbungle64/ecovacs-deebot.js 

// notes : peut avoir besoin de tenter la connection 2 ou 3 fois, du au random number. même des fois plus, insister
// est en primcipe compatible devices multiples

'use strict';


const { Driver } = require('homey');

const ecovacsDeebot = require('ecovacs-deebot');
const EcoVacsAPI = ecovacsDeebot.EcoVacsAPI;
const http = require('http');

global.DeviceAPI = null;
let continent;

const VacuumDevice = require('./device');

class VacuumDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Driver Vacuum has been initialized');
  }

    onMapDeviceClass( device ) {
            return VacuumDevice;
      }
    

      async onPair(session) {
        let username = "";
        let password = "";
        

        session.setHandler("login", async (data) => {
          username = data.username;
          password = data.password;
          let credentialsAreValid = false;

          await httpGetJson('http://ipinfo.io/json').then(async (json) => {
            let country = json.country.toLowerCase();
	          continent = ecovacsDeebot.countries[country.toUpperCase()].continent.toLowerCase();
            
            let device_id = EcoVacsAPI.md5(between(10000000,99999999));

	          DeviceAPI = new EcoVacsAPI(device_id, country, continent);

            let password_hash = EcoVacsAPI.md5(password);
            	          
            await DeviceAPI.connect(username, password_hash).then(() => {
              this.log("Connected!");
              credentialsAreValid = true;
            }).catch((e) => {
              this.log("Failure in connecting!");
            });
  
          });

          // return true to continue adding the device if the login succeeded
          // return false to indicate to the user the login attempt failed
          // thrown errors will also be shown to the user
          return credentialsAreValid;

        });
    
        session.setHandler("list_devices", async () => {

          let devices;
    
          await DeviceAPI.devices().then((devicesList) => {
            //console.log("Devices:", JSON.stringify(devicesList));
            
            devices = devicesList.map((myDevice) => {
              //console.log ("myDevice: ",myDevice);
              //console.log(DeviceAPI.getVersion());
              return {
                name: myDevice.nick,
                data: {
                  id: myDevice.did,
                  api: DeviceAPI,
                  username: username,
                  password: password,
                  geo: continent,
                  vacuum: myDevice
                },
                
              };
            });
          });

          //console.log ("liste: ",devices);
          
    
          return devices;
        });
      }
    
      

        
    async onRepair(session, device) {
        // Argument session is a PairSocket, similar to Driver.onPair
        // Argument device is a Homey.Device that's being repaired
        this.log ('Repairing');
        let data = device.getData();
        this.log('device data : ', data);

        let username = data.username;
        let password = data.password;

        await httpGetJson('http://ipinfo.io/json').then(async (json) => {
            let country = json.country.toLowerCase();
	          continent = ecovacsDeebot.countries[country.toUpperCase()].continent.toLowerCase();
            
            let device_id = EcoVacsAPI.md5(between(10000000,99999999));

	          DeviceAPI = new EcoVacsAPI(device_id, country, continent);

            let password_hash = EcoVacsAPI.md5(password);
            	          
            await DeviceAPI.connect(username, password_hash).then(() => {
              this.log("Connected!");
              credentialsAreValid = true;
            }).catch((e) => {
              this.log("Failure in connecting!: ", e);
            });
  
          });

        data.api=DeviceAPI;
        this.log ('Data API : ', data.api);
        device.onAdded();

        //session.setHandler("my_event", (data) => {
          // Your code
        //});

        //session.setHandler("disconnect", () => {
          // Cleanup
        //});
      }
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', function(){
        try {
          const json = JSON.parse(rawData);
          
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}

function between(min, max) {  
  let num = Math.floor(
    Math.random() * (max - min) + min
  )
  
  return num.toString();
}

module.exports = VacuumDriver;

