// based on https://github.com/joostth/sucks.js 

'use strict';


const { Driver } = require('homey');
const sucks = require('sucks')
	, EcoVacsAPI = sucks.EcoVacsAPI
	, VacBot = sucks.VacBot;
const VacuumDevice = require('./device');

class VacuumDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Driver Vacuum has been initialized');
  }

    

    onMapDeviceClass( device ) {
            return STBDevice;
      }
    
    async onPair(session) {
      this.log('Vacuum pairing started');
            
      const devices = [];
 
        session.setHandler("list_devices", async function () {
            // emit when devices are still being searched
            session.emit("list_devices", devices);

            // return devices when searching is done
            return devices;
          });
        
        // the STB has to be on same network as Homey
        //let myIP = ip.address();
        //let lastDot = myIP.lastIndexOf(".");
        //let ipAddrPrefix = myIP.substring(0, lastDot + 1);
        
        
        // for each ip detect if there is a device
        //for (let i = 2; i < 255; i++) {

        //  let testIP = ipAddrPrefix + i;
        //  this.getInfo(testIP, session, devices);

        //}
  
        return ;
      }
    
    onRepair(session, device) {
        // Argument session is a PairSocket, similar to Driver.onPair
        // Argument device is a Homey.Device that's being repaired
        this.log ('Repairing');
        
      
        session.setHandler("my_event", (data) => {
          // Your code
        });

        session.setHandler("disconnect", () => {
          // Cleanup
        });
      }
}

module.exports = STBDriver;
