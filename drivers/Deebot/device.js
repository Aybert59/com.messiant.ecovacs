'use strict';

const { Device } = require('homey');
const tools = require('../../lib/tools');
const ecovacsDeebot = require('ecovacs-deebot');
const EcoVacsAPI = ecovacsDeebot.EcoVacsAPI;

const http = require('http');

const SYNC_INTERVAL = 1000 * 60  // 60 seconds
//let vacbot;

class VacuumDevice extends Device {

    
  /**
   * onInit is called when the device is initialized.
   * this is the only method called upon Homey system boot
   * 
   * when adding a new device, onAdded is called after this one
   */
  async onInit() {
      
    //this.setUnavailable();
    this.log('Vacuum has been initialized');
    this.log(this.getName());
       
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    
    const cleanZoneAction = this.homey.flow.getActionCard('clean_zone');
    cleanZoneAction.registerRunListener(this.flowCleanZoneAction.bind(this));
    cleanZoneAction.registerArgumentAutocompleteListener("zone", this.flowAutocompleteCleanZoneAction.bind(this));

    let api = DeviceAPI;
    if (api == null)
    {
      this.log('system reboot, reconnecting');
      this.driver.onRepair (null, this);
    } else {
      this.log('new device, do nothing else');
    }
    
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

    let voidTable = [];
    this.setStoreValue ('areas', voidTable);

    console.log('ApiVersion : ',api.getVersion()); 
    // for the moment vacbot is global : may not work with multiple devices
    this.vacbot = api.getVacBot(api.uid, EcoVacsAPI.REALM, api.resource, api.user_access_token, data.vacuum, data.geo);
    
    
    this.vacbot.on("ready", (event) => {
		console.log("Vacuum is ready");
          this.setAvailable();
          this.syncStatus(this.vacbot);

          this.setSettings({
            // only provide keys for the settings you want to change
            username: data.username,
            password: data.password,
          });

          const changeChargeStateTrigger = this.homey.flow.getDeviceTriggerCard('charge_state_change');
          const changeCleanStateTrigger = this.homey.flow.getDeviceTriggerCard('clean_state_change');
          const changeZoneTrigger = this.homey.flow.getDeviceTriggerCard('zone_change');

          this.vacbot.run("GetMaps", true, false);


          this.vacbot.on("BatteryInfo", (battery) => {
            this.setCapabilityValue('measure_battery',Math.round(battery));
          });
  
          this.vacbot.on("CleanReport", (status) => {
            if (status == "idle")
            {
              this.setCapabilityValue('onoff', false);
            } else {
              this.setCapabilityValue('onoff', true);
            }
            
            let oldStatus = this.getCapabilityValue('current_clean');
            this.setCapabilityValue('current_clean', status);

            if (oldStatus && (oldStatus != status))
            {
              try {
                changeCleanStateTrigger.trigger(this);
              }
              catch (error)
              {
                console.log ('trigger error : ', error);
              }
            }
          });
  
          this.vacbot.on("ChargeState", (status) => {
            let oldStatus = this.getCapabilityValue('current_charge');
            this.setCapabilityValue('current_charge', status);

            if (oldStatus && (oldStatus != status))
            {
              try {
                changeChargeStateTrigger.trigger(this);
              }
              catch (error)
              {
                console.log ('trigger error : ', error);
              }
            }
          });

          //vacbot.on("SleepStatus", (status) => {
          //  console.log("Sleep status: %s", status);
          //});
  
          //vacbot.on("PushRobotNotify", (values) => {
          //  console.log("Notification '%s': %s", values.type, values.act);
          //});

          this.vacbot.on('Maps', (maps) => {     
            for (const i in maps['maps']) {
                if (maps['maps'][i]['mapIsCurrentMap'])
                {
                  // this.log('Maps: ', maps);
                  const mapID = maps['maps'][i]['mapID'];
                  this.vacbot.run('GetSpotAreas', mapID);
                }
            }
          });

          this.vacbot.on('MapSpotAreas', (spotAreas) => {
            // this.log('MapSpotAreas: ', spotAreas);
            for (const i in spotAreas['mapSpotAreas']) {
                const spotAreaID = spotAreas['mapSpotAreas'][i]['mapSpotAreaID'];
                this.vacbot.run('GetSpotAreaInfo', spotAreas['mapID'], spotAreaID);
            }
          });
        
          this.vacbot.on('MapSpotAreaInfo', (area) => {
            // this.log('MapSpotAreaInfo: ', area.mapSpotAreaID, area.mapSpotAreaName);
            // remplir un tableau de parametre propre au device
            var tableAreas = this.getStoreValue ('areas');
            if (! tableAreas.find (o => o.id == area.mapSpotAreaID))
            {
              tableAreas.push (
                {
                  name: area.mapSpotAreaName,
                  id: area.mapSpotAreaID,
                  toto: area.mapSpotAreaBoundaries,
                  boundaries: this.convertBoundaries(area.mapSpotAreaBoundaries),
                }
              );
              this.setStoreValue ('areas', tableAreas);

            }
          });

            this.vacbot.on("DeebotPosition", (values) => {
              // console.log ('Position : ', values);
              let zone = "unknown";
              let oldZone = this.getCapabilityValue('current_zone');

              var tableAreas = this.getStoreValue ('areas');
              tableAreas.forEach(function(area) {
                let coord = values.split(',');
                if (tools.pointInPolygon (area.boundaries, [Number(coord[0]), Number(coord[1])]))
                {
                  // console.log ('OK for ', area.name);
                  zone = area.name;
                }
              });

              this.setCapabilityValue('current_zone', zone);
              if (oldZone && (oldZone != zone))
              {
                try {
                  changeZoneTrigger.trigger(this);
                }
                catch (error)
                {
                  console.log ('trigger error : ', error);
                }
              } 
            });

          //vacbot.on("DeebotPositionCurrentSpotAreaID", (values) => {
          //    console.log("DeebotPositionCurrentSpotAreaID : ", values);
          //    this.setCapabilityValue('current_zone', values);
          //});

            //vacbot.on("ChargePosition", (values) => {
            //  console.log("ChargePosition : ", values);
            //});
  
	  });

    this.vacbot.connect();

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


    while (true) {

        this.log('syncing...');
        await this.syncStatus(this.vacbot)
              .catch(error => {
				        this.log('Sync error :', error);
			        });
        
        await delay(SYNC_INTERVAL);
 
    }
    
  }

  async ready() {
    this.log('device:ready');
  }

  onDiscoveryResult(discoveryResult) {
    this.log('onDiscoveryResult');
    return discoveryResult.id === this.getData().id;
  }

  onDiscoveryAvailable(discoveryResult) {
    this.log('onDiscoveryAvailable', discoveryResult);
    //this.setStoreValue('address', discoveryResult.address);
  }

  onDiscoveryAddressChanged(discoveryResult) {
    this.log('onDiscoveryAddressChanged', discoveryResult);
    // todo set in store
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    this.log('onLastSeenChanged', discoveryResult);
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
      this.vacbot.run("Stop");
      this.vacbot.run("Charge");
    } else {
      // was idle : start cleaning (general)
      this.log ('start cleaning');
      this.vacbot.run("Clean");
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
          this.vacbot.spotArea(args.zone.id);
      }
    
    
    
    //////////////////////////////////////////// Utilities ///////////////////////////////////////
    
    convertBoundaries (areaBoundaries) {
      let tableau = areaBoundaries.split (';');
      let resultat = [];

      tableau.forEach(function(element) {
        let point = element.split(',');
        resultat.push ([Number(point[0]), Number(point[1])]);
      });

      return resultat;
    }
   
    
    //////////////////////////////////////////// real device status synchronization ///////////////////////////////////////
    
    async syncStatus(robot) {
        
        robot.run("GetBatteryState");
        robot.run("GetCleanState");
        // robot.run("GetPosition");  // no need, position is sent regularly when the bot is actually moving

        //var tableAreas = this.getStoreValue ('areas');
        //console.log (tableAreas);
      }
}

module.exports = VacuumDevice;
