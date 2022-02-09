'use strict';

const { Device } = require('homey');

const ecovacsDeebot = require('ecovacs-deebot');
const EcoVacsAPI = ecovacsDeebot.EcoVacsAPI;

const http = require('http');

const SYNC_INTERVAL = 1000 * 60  // 60 seconds
let vacbot;

class VacuumDevice extends Device {

    
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      
    this.setUnavailable();
    this.log('Vacuum has been initialized');
    this.log(this.getName());
      
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    
    const cleanZoneAction = this.homey.flow.getActionCard('clean_zone');
    cleanZoneAction.registerRunListener(this.flowCleanZoneAction.bind(this));
    cleanZoneAction.registerArgumentAutocompleteListener("zone", this.flowAutocompleteCleanZoneAction.bind(this));
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Vacuum has been added');
    this.log(this.getName());

    let data = this.getData();
    let api = DeviceAPI;

    let voidTable = [];
    this.setStoreValue ('areas', voidTable);

    console.log('ApiVersion : ',api.getVersion()); 
    // for the moment vacbot is global : may not work with multiple devices
    vacbot = api.getVacBot(api.uid, EcoVacsAPI.REALM, api.resource, api.user_access_token, data.vacuum, data.geo);
    
    vacbot.on("ready", (event) => {
		console.log("Vacuum is ready");
          this.setAvailable();
          this.syncStatus(vacbot);

          vacbot.run("GetMaps", true, false);

          vacbot.on("BatteryInfo", (battery) => {
            console.log("Battery level: %d\%", Math.round(battery));
            this.setCapabilityValue('measure_battery',Math.round(battery));
          });
  
          vacbot.on("CleanReport", (status) => {
            console.log("Clean status: %s", status);
            if (status == "idle")
            {
              this.setCapabilityValue('onoff', false);
            } else {
              this.setCapabilityValue('onoff', true);
            }
          });
  
          vacbot.on("ChargeState", (status) => {
            console.log("Charge status: %s", status);
          });

          vacbot.on("SleepStatus", (status) => {
            console.log("Sleep status: %s", status);
          });
  
          vacbot.on("PushRobotNotify", (values) => {
            console.log("Notification '%s': %s", values.type, values.act);
          });

          vacbot.on('Maps', (maps) => {     
            for (const i in maps['maps']) {
                if (maps['maps'][i]['mapIsCurrentMap'])
                {
                  // this.log('Maps: ', maps);
                  const mapID = maps['maps'][i]['mapID'];
                  vacbot.run('GetSpotAreas', mapID);
                }
            }
          });

          vacbot.on('MapSpotAreas', (spotAreas) => {
            // this.log('MapSpotAreas: ', spotAreas);
            for (const i in spotAreas['mapSpotAreas']) {
                const spotAreaID = spotAreas['mapSpotAreas'][i]['mapSpotAreaID'];
                vacbot.run('GetSpotAreaInfo', spotAreas['mapID'], spotAreaID);
            }
          });
        
          vacbot.on('MapSpotAreaInfo', (area) => {
            // this.log('MapSpotAreaInfo: ', area.mapSpotAreaID, area.mapSpotAreaName);
            // remplir un tableau de parametre propre au device
            var tableAreas = this.getStoreValue ('areas');
            if (! tableAreas.find (o => o.id == area.mapSpotAreaID))
            {
              tableAreas.push (
                {
                  name: area.mapSpotAreaName,
                  id: area.mapSpotAreaID,
                }
              );
              this.setStoreValue ('areas', tableAreas);
            }
          });
       
  
	});

    vacbot.connect();

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));



    while (true) {

        this.log('syncing...');
        await this.syncStatus(vacbot)
              .catch(error => {
				        this.log('Sync error :', error);
			        });
        
        await delay(SYNC_INTERVAL);
 
    }
    
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    // this.log('MyDevice settings where changed', oldSettings, newSettings, changedKeys);
  }

  
  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
      // should perform some cleanup
  }

        
    //////////////////////////////////////////// Capabilities ///////////////////////////////////////
    
  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    if (this.getCapabilityValue('onoff'))
    {
      // was not idle : go back to charge
      this.log ('stop cleaning');
      vacbot.run("Stop");
      vacbot.run("Charge");
    } else {
      // was idle : start cleaning (general)
      this.log ('start cleaning');
      vacbot.run("Clean");
    }
  }
    
    
    
   
    
    //////////////////////////////////////////// Flows ///////////////////////////////////////
    
    async flowAutocompleteCleanZoneAction (query, args) {
      var tableAreas = this.getStoreValue ('areas');
      var filtered = tableAreas.filter ((element) => {
        return element.name.toLowerCase().includes(query.toLowerCase()) 
      });         
      return filtered;
    }
  
    async flowCleanZoneAction (args, state) {
      
          this.log ("cleaning zone : ", args.zone);
                    // args.zone.name ; args.zone.id
          vacbot.spotArea(args.zone.id);
      }
    
    
    
    //////////////////////////////////////////// Utilities ///////////////////////////////////////
    
    
   
    
    //////////////////////////////////////////// real device status synchronization ///////////////////////////////////////
    
    async syncStatus(robot) {
        
        robot.run("GetBatteryState");
        robot.run("GetCleanState");

        //var tableAreas = this.getStoreValue ('areas');
        //this.log ('areas: ', tableAreas);
    }
}

module.exports = VacuumDevice;
