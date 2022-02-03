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
    
    
      
    //const changeChannelAction = this.homey.flow.getActionCard('change_channel');
    //  changeChannelAction.registerRunListener(this.flowChangeChannelAction.bind(this));
    
        
    //const changeChannelCondition = this.homey.flow.getConditionCard('current_channel');
    //  changeChannelCondition.registerRunListener(this.flowCurrentChannel.bind(this));
    
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Vacuum has been added');
    this.log(this.getName());

    let data = this.getData();
    let api = DeviceAPI;


    console.log('ApiVersion : ',api.getVersion()); 
    // for the moment vacbot is global : may not work with multiple devices
    vacbot = api.getVacBot(api.uid, EcoVacsAPI.REALM, api.resource, api.user_access_token, data.vacuum, data.geo);
    
    vacbot.on("ready", (event) => {
		console.log("Vacuum is ready");
          this.setAvailable();
          this.syncStatus(vacbot);

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
	});

    vacbot.connect();

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));



    while (true) {

        this.log('syncing...');
        await this.syncStatus(vacbot)
              .catch(error => {
				this.log('Sync error :', error);
				return;
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
    
    async flowChangeChannelAction (args, state) {
         
        if (this.getCapabilityValue ('onoff') == true) {
            const canalID = this.getChannelIDByNum (args.canal);
            this.triggerCapabilityListener('station_capability_static', canalID, null);
        }
    }
    
    
    
    async flowCurrentChannel (args, state) {
         
        if (this.getCapabilityValue ('onoff') == true) {
            const channelNum = this.getCapabilityValue ('measure_channel_capability');

            if (args.canal == channelNum)
                return true;
            else
                return false;
        } else {
            return false;
        }
    }
    
    
    
    
    //////////////////////////////////////////// Utilities ///////////////////////////////////////
    
    
   
    
    //////////////////////////////////////////// real device status synchronization ///////////////////////////////////////
    
    async syncStatus(robot) {
        
        robot.run("GetBatteryState");
        robot.run("GetCleanState");
    }
}

module.exports = VacuumDevice;
