'use strict';

const http = require('http');
const https = require('https');
const { Device } = require('homey');

const SYNC_INTERVAL = 1000 * 10  // 10 seconds

class STBDevice extends Device {

    static channelsDB;
    static channelId;
    static channelNum;
    static channelName;
    
    static playedMediaState;
    static osdContext;
    
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      
    this.channelsDB = require('../../channels/channels.json'); // would be better with a file downloaded from the web
      
      
    this.log('STB has been initialized');
    this.log(this.getName());
      
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    
    this.registerCapabilityListener("volume_down", this.onCapabilityVolDown.bind(this));
    this.registerCapabilityListener("volume_up", this.onCapabilityVolUp.bind(this));
    this.registerCapabilityListener("volume_mute", this.onCapabilityVolMute.bind(this));
      
    if (this.hasCapability ('station_capability_static'))
    {
      this.registerCapabilityListener("station_capability_static", this.onCapabilityStation.bind(this));
    }
    this.registerCapabilityListener("user_pref_station", this.onCapabilityPrefStation1.bind(this));

    this.registerCapabilityListener("button_ok", this.onCapabilityButtonOK.bind(this));
    this.registerCapabilityListener("button_pause", this.onCapabilityButtonPause.bind(this));
      
    this.updateChannels();
      
    const changeChannelAction = this.homey.flow.getActionCard('change_channel');
      changeChannelAction.registerRunListener(this.flowChangeChannelAction.bind(this));
    const changeStateAction = this.homey.flow.getActionCard('change_state');
      changeStateAction.registerRunListener(this.flowChangeStateAction.bind(this));
        
    const changeChannelCondition = this.homey.flow.getConditionCard('current_channel');
      changeChannelCondition.registerRunListener(this.flowCurrentChannel.bind(this));
    const currentStateCondition = this.homey.flow.getConditionCard('current_state');
      currentStateCondition.registerRunListener(this.flowCurrentState.bind(this));
 
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
    this.log(this.getName());
    this.setAvailable();
      
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

      let addr = this.getStoreValue ('ipaddress');
      const testuri = 'http://' + addr + ':8080/remoteControl/cmd?operation=10';
      this.setStoreValue ('uri',testuri);

      while (true) {
//          if (this.getAvailable()) {
              this.log('syncing...');
              await this.syncStatus()
              .catch(error => {
				this.log('Sync error :', error);
				return;
			    });
              await delay(SYNC_INTERVAL);
 //         }
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

    async sendKey (key, mode) {
        
        // reference here https://tv-orange.pourqui.com/commandes.html
        
        // mode :
        //      0 : envoi unique de touche
        //      1 : appui prolongé de touche
        //      2 : relacher la touche après un appui prolongé
this.log ('sending key : ', key);
        let ipAdr = this.getStoreValue ('ipaddress');
        let uri = 'http://' + ipAdr + ':8080/remoteControl/cmd?operation=01&key=' + key + '&mode=' + mode;
        http.get (uri);
        
   //     try {    http.get(uri).on('error', function(e) {
   //             this.log(e);
   //             this.setUnavailable();
   //         });
        try {    http.get(uri);
        } catch (e) {
            this.log(e.message);
            this.setUnavailable();
        }
    }
    
    //////////////////////////////////////////// Capabilities ///////////////////////////////////////
    
  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
      this.sendKey (116, 0); // on/off
  }
    
    async onCapabilityVolDown(value, opts) {
        this.sendKey (114, 0);
    }
    async onCapabilityVolUp(value, opts) {
        this.sendKey (115, 0);
    }
    async onCapabilityVolMute(value, opts) {
        this.sendKey (113, 0);
    }
    
    async onCapabilityStation (value, opts) {
        
        // as there is no way to get the label from the picker, necessity to maintain a separate DB file
        let ipAdr = this.getStoreValue ('ipaddress');
        let key = value.toString();
        
        if (key.charAt(0) == 'A') {
            const chaine = key.substring(1);
            for (var i = 0; i < chaine.length; i++) {
                var c = parseInt(chaine.charAt(i)) + 512;
                setTimeout(() => this.sendKey (c, 0), i * 200); // wait a bit (200ms) between each key
            }
        } else {
            let uri = 'http://' + ipAdr + ':8080/remoteControl/cmd?operation=09&epg_id=' + key.padStart(10,'*') + '&uui=1';
            http.get (uri);
        }
        
        setTimeout(() => this.syncStatus (), 2000); // force status synchronization after 2 sec
    }
    
    async onCapabilityPrefStation1 (value, opts) {
        const channel = this.getSetting ('PrefChannel1');
        this.log ('user preferred station 1', channel, opts);
        this.onCapabilityStation (channel, opts);
        this.setCapabilityValue ('user_pref_station', false); // don't change the button status
        
        setTimeout(() => this.syncStatus (), 2000); // force status synchronization after 2 sec
    }
    
    async onCapabilityButtonPause(value, opts) {
        const status = this.getCapabilityValue ('button_pause');
        this.setCapabilityValue ('button_pause', !status);
        this.sendKey (164, 0);
        
        setTimeout(() => this.syncStatus (), 2000); // force status synchronization after 2 sec
    }
    async onCapabilityButtonOK(value, opts) {
        this.setCapabilityValue ('button_ok', false);
        this.sendKey (352, 0);

        setTimeout(() => this.syncStatus (), 2000); // force status synchronization after 2 sec
    }
    
    updateChannels() {
        
        // if one day we could have it dynamic
       
    }
    
    //////////////////////////////////////////// Flows ///////////////////////////////////////
    
    async flowChangeChannelAction (args, state) {
         
        if (this.getCapabilityValue ('onoff') == true) {
            const canalID = this.getChannelIDByNum (args.canal);
            this.triggerCapabilityListener('station_capability_static', canalID, null);
        }
    }
    
    async flowChangeStateAction (args, state) {
        const status = this.getCapabilityValue ('button_pause');
        
        if (this.getCapabilityValue ('onoff') == true) {
            if ((status == true) && (args.state == "PLAY"))
                this.triggerCapabilityListener('button_pause', null, null);
            if ((status == false) && (args.state == "PAUSE"))
                this.triggerCapabilityListener('button_pause', null, null);
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
    
    async flowCurrentState (args, state) {
         
        if (this.getCapabilityValue ('onoff') == true) {
            const state = this.getCapabilityValue ('button_pause');
            
            if (args.state == "PAUSE")
                return state;
            else
                return !state;
        } else {
            return false;
        }
    }
    
    
    
    //////////////////////////////////////////// Utilities ///////////////////////////////////////
    
    
    findChannelID(channel) {
      if (channel.id == this.channelId)
          return true;
        else
          return false;
    }
    
    findChannelNum(channel) {
      if (channel.channel == this.channelNum)
          return true;
        else
          return false;
    }
    
    findChannelName(channel) {
      if (channel.name.indexOf(this.channelName) >= 0)
          return true;
        else
          return false;
    }
    
    getChannelNumByID (id) {
        if (id == undefined) {
            return 0;
        }
        this.channelId = id;
        var channel = this.channelsDB.find (this.findChannelID, this);
        if (channel == undefined)
            return 0;
        else
            return channel.channel;
    }
    
    getChannelNumByName (name) {
        
        this.channelName = name;
        var channel = this.channelsDB.find (this.findChannelName, this);

        // cas nom traité : FTVREPLAY, popuphandler, ISMOSAIC, ...
        // ajouter Disney+ 68
        // AmazonInstantVideo = PrimeVideo 67

        if (channel == undefined)
        {
            this.channelId = "0";
            return 0;
        }
        else {
            this.channelId = channel.id;
            return channel.channel;
        }
            
    }
    
    getChannelIDByNum (num) {
        if (num == undefined) {
            return 0;
        }
        this.channelNum = num;
        var channel = this.channelsDB.find (this.findChannelNum, this);
        if (channel == undefined)
            return 0;
        else
            return channel.id;
    }
    
    //////////////////////////////////////////// real device status synchronization ///////////////////////////////////////
    
    async syncStatus() {
        
        // never call sendKey within this function, otherwise this creates a loop
        
        var channelNum;

        let testuri = this.getStoreValue ('uri');
                
        http.get(testuri, (res) => {
          const { statusCode } = res;
          const contentType = res.headers['content-type'];

          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            if (statusCode == 200) {
              try {
                let parsedData = JSON.parse(rawData);
                  this.setAvailable();
                  const status = parsedData.result.data.activeStandbyState;
                  
                  if (status == '0') {
                      this.setCapabilityValue ('onoff', true);
                      
                      // osdContext can be : popuphandler, home,
                      // old decoder : HOMEPAGE,
                      this.osdContext = parsedData.result.data.osdContext;
                      
                      if (this.osdContext == "LIVE") {
                            this.playedMediaState = parsedData.result.data.playedMediaState;
                            if (this.playedMediaState == "PLAY")
                                this.setCapabilityValue ('button_pause', false);
                            else
                                this.setCapabilityValue ('button_pause', true);
                            
                            this.log ('context : LIVE, State : ', this.playedMediaState); // bug avec le nouveau decodeur, affiche toujours PLAY meme en pause
                            this.channelId = parsedData.result.data.playedMediaId;
                      }
                      else {
                          this.playedMediaState = "";
                          this.channelId = "";
                          channelNum = "0";
                      }
                      
                      if (this.channelId == "") {   // cas de netflix ou de homepage
                          this.log ('search for ID of ', parsedData.result.data.osdContext);
                          channelNum = this.getChannelNumByName (parsedData.result.data.osdContext);
                      } else {
                          channelNum = this.getChannelNumByID (parsedData.result.data.playedMediaId);
                      }
                      
                      if (channelNum != "0") {
                          this.setCapabilityValue ('measure_channel_capability', channelNum);
                      
                          if (this.channelId != undefined)
                          {
                              if (this.hasCapability ('station_capability_static'))
                              {
                                  this.setCapabilityValue ('station_capability_static', this.channelId);
                              }
                          }
                      }
                  } else {
                      this.setCapabilityValue ('onoff', false);
                      this.playedMediaState = "";
                      this.channelId = "";
                  }
                  this.log('...sync\'d');
                  
                } catch (e) {
                    this.log(e.message);
                    this.setUnavailable();
              }
            }
          });
        }).on('error', (e) => {
            this.setUnavailable();
            this.log(`Got error: ${e.message}`);
        });
    }
    
}

module.exports = STBDevice;
