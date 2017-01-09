"use strict";

var request = require('request');
var xml2js = require('xml2js');
var UpnpVariable = require('./upnp_variable.js').UpnpVariable;
var UpnpAction = require('./upnp_action.js').UpnpAction;
var XmlEntities = require('html-entities').XmlEntities;
var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var fs = require('fs');

class UpnpBaseService
{
	constructor(device, serviceData, eventServer, callback)
	{
		Logger.log("Création du service : " + JSON.stringify(serviceData), LogType.INFO);
		this._device = device;
    this._eventServer = eventServer;
    this._eventSubscribe = false;
		this._subscriptionTimeout = 600;
		this._variables = [];
		this._actions = [];
    
		this._initialize(serviceData);
    this._processDeviceSCPD(callback);
	}
  
  update(serviceData)
  {
    Logger.log("Mise a jour du service : " + JSON.stringify(serviceData), LogType.INFO);
    this._initialize(serviceData);
  }

	_initialize(serviceData)
	{
		this._type = serviceData.serviceType[0];
		this._ID = serviceData.serviceId[0];
		this._controlURL = this._updateServiceURL(serviceData.controlURL[0]);
    this._eventSubURL = this._updateServiceURL(serviceData.eventSubURL[0]);
    this._SCPDURL = this._updateServiceURL(serviceData.SCPDURL[0]);
  }
  
  _updateServiceURL(path)
  {
    if (!path) return;
    if (path.indexOf('http') !== -1) return path;
    if (path.charAt(0) != '/') return this._device.BaseAddress + "/" + path;
    return this._device.BaseAddress + path;
  }
  
  _processDeviceSCPD(callback)
  {
		//On récupère le xml listant les actions et les variables
		request(this._SCPDURL, (error, response, body) => {
			if (error || response.statusCode != 200)
			{
				Logger.log("Unable to read SCPDURL, url : " + this._SCPDURL + ", err : " + error, LogType.ERROR);
				if (callback)
					callback(error);
			}
			else if (body != '')
			{
				xml2js.parseString(body, (err, data) => {
          if (err)
          {
            Logger.log("Unable to parse SCPDURL XML, source : " + body + ", err : " + err, LogType.ERROR);
          }
					else
          {
            this.processSCPD(data.scpd, true);   
            if (callback) callback();
            this._specializedInitialisation();
            if (this.HasEvent) this.subscribe();
          }
				});
			}
			else
			{
				Logger.log("Body is empty for " + this._SCPDURL, LogType.WARNING );
				//I don't see any case on which we should do a _specializedInitialisation
			}
		});
	}
  
  _specializedInitialisation()
  { }

	//fromDevice == true if from device, false if from template
	processSCPD(scpd, fromDevice)
	{
    if (!scpd) 
    {
      Logger.log("SCPD is null for " + this.Device.UDN + "::" + this.ID + ", source " + fromDevice?"device":"template", LogType.DEBUG);
      return;
    }
    if (scpd.serviceStateTable && scpd.serviceStateTable[0] && scpd.serviceStateTable[0].stateVariable)
		{
			scpd.serviceStateTable[0].stateVariable.forEach((item) =>	{
				if (!this._variables.some(elem => elem.Name == item.name[0]))
				{
					var variable = new UpnpVariable(this, item, fromDevice);
					variable.on('updated', (varObj, newVal) => { this.Device.emit('variableUpdated', varObj, newVal) });
					this._variables.push(variable);
					this.Device.emit('variableCreated', variable);
				}
				/*else if (fromDevice){
				this._variables.filter((elem) => { return elem.Name == item.name[0]})[0].updateDefinition();
				}*/
			});
		}
		else
			Logger.log("No variable found for service " + this.Device.UDN + "::" + this.ID + ", source " + fromDevice?"device":"template", LogType.DEBUG);

		if (scpd.actionList && scpd.actionList[0] && scpd.actionList[0].action)
		{
			scpd.actionList[0].action.forEach((item) =>	{
				//Si l'action n'existe pas, on la créer
				if (!this._actions.some(elem => elem.Name == item.name[0]))
				{
					var action = new UpnpAction(this, item, fromDevice);
					this._actions.push(action);
					this.Device.emit('actionCreated', action);
				}
				/*else if (fromDevice){
				this._actions.filter((elem) => { return elem.Name == item.name[0]})[0].updateDefinition();
				}*/
			});
		}
		else
			Logger.log("No action found for service " + this.Device.UDN + "::" + this.ID + ", source " + fromDevice?"device":"template", LogType.DEBUG);
	}

	/*getVariableByName(name){
	this._variables.forEach((item) => {
	console.log('test de ' + item.Name + ' avec ' + name);
	if (item.Name == name) return item;
	});
	throw new Error("Unable to get variable with name " + name);
	}*/

	processEvent(data)
	{
		Logger.log("Event Processing " + JSON.stringify(data), LogType.DEBUG);

		var properties = data['e:propertyset']['e:property'];

		for (var prop in properties)
		{
			var key = Object.keys(properties[prop]);
			var variable = this.getVariableByName(key);
			if (variable)
			{
				variable.Value = properties[prop][key][0];
				if (variable.Name == 'LastChange')
				{
					this.processLastChangeEvent(properties[prop][key][0]);
				}
			}
			else
				Logger.log("Unable to fully process event " + JSON.stringify(properties) + " for propertie " + key, LogType.WARNING);
		}
	}

	//Body could be an xml or directly a json object
	processLastChangeEvent(body)
	{
		//Si c'est déjà un objet, on le traite, sinon on le parse puis on le traite
		//Il faut gérer plusieur cas, test OK sur TV LG et Freeplayer
		if (body.Event)
		{
			Logger.log("Body LastChange Event " + JSON.stringify(body.Event), LogType.DEBUG);
			var eventProperties = body.Event[0];
			if (!eventProperties)
				eventProperties = body.Event;
			var instance = eventProperties;
      if (eventProperties.InstanceID && eventProperties.InstanceID[0]) instance = eventProperties.InstanceID[0];
			for (var prop in instance)
			{
				if (prop == '$')
					continue;
				Logger.log("Processing update propertie " + JSON.stringify(prop) + " with val " + JSON.stringify(instance[prop][0]['$'].val), LogType.DEBUG);
				var variable = this.getVariableByName(prop);
				if (variable)
				{
					variable.Value = instance[prop][0]['$'].val;
				}
				else
					Logger.log("Unable to process LastChange propertie Event " + prop + " with value " + instance[prop][0]['$'].val + " of service " + this.Device.UDN + "::" + this.ID, LogType.WARNING);
			}
		}
		else
		{
			xml2js.parseString(body, (err, data) => {
				//Manage Error
				if (err)
				{
					Logger.log("Error decoding LastChange Event : " + this.Device.UDN + '::' + this.ID + " ==> xml : " + JSON.stringify(body) + ", err : " + err, LogType.ERROR);
					this.Device.emit('error', "Error decoding LastChange Event : " + this.Device.UDN + '::' + this.ID + " ==> xml : " + JSON.stringify(body) + ", err : " + err);
				}
				else
					this.processLastChangeEvent(data)
			});
		}
	}

	prepareForRemove()
	{
		this.unsubscription();
		this.Device.emit('serviceOffline', this);
	}

	getVariableByName(name)
	{
		for (var prop in this._variables)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (name == this._variables[prop].Name)
			{
				return this._variables[prop];
			}
		}
		Logger.log("Unable to find the variable with name " + name, LogType.DEBUG);
		return null;
	}

	getActionByName(name)
	{
		this._actions.forEach((item) =>
		{
			if (item.Name == name)
				return item;
		}
		);
	}
  
  get DescriptionURL()
  {
    return this._SCPDURL;
  }

	get Type()
	{
		return this._type;
	}

	get ControlUrl()
	{
		return this._controlURL;
	}

	get ID()
	{
		return this._ID;
	}

	get Device()
	{
		return this._device;
	}

	getActionByName(actionName)
	{
		for (var prop in this._actions)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (actionName == this._actions[prop].Name)
			{
				return this._actions[prop];
			}
		}
		Logger.log("Unable to find the action with name " + actionName, LogType.DEBUG);
		return null;
	}

	subscribe(tryCount)
	{
    if (!tryCount) tryCount = 1; 
    else if (tryCount>5) 
    {
      Logger.log("Erreur d'inscription aux evenements après 5 tentatives, annulation de l'inscription aux evenement du service, url : " + this._eventSubURL + " pour le service " + this._ID, LogType.ERROR);
      //Le service est probablement éteint, on coupe le service ou pas ?
      //this.prepareForRemove();
      return;
    }
    
    request(
		{
			//host: this._device.Location.hostname,
			//port: this._device.Location.port,
			uri: this._eventSubURL,
			method: 'SUBSCRIBE',
			headers:
			{
				'CALLBACK': "<" + this._eventServer + ">",
				'NT': 'upnp:event',
				'TIMEOUT': 'Second-' + this._subscriptionTimeout
			}
		}, (error, response, body) =>
		{
      if (error || response.statusCode != 200)
			{
				Logger.log("Erreur d'inscription au evenement, url : " + this._eventSubURL + " pour le service " + this._ID + 
          ", reste " + (5-tryCount) + " tentative(s)" + 
          ", response : " + JSON.stringify(response) + ", err : " + error, LogType.WARNING);
				//Gestion du code d'erreur pour detecté les services deconnecté??
        this._resubscribe = setTimeout((service,tries) =>
				{
					service.subscribe(tries);
				}, 15 * 1000, this, ++tryCount);
				return;
			}
			else
			{
				Logger.log("Inscription au evenement, url : " + this._eventSubURL + ", response : " + JSON.stringify(response), LogType.DEBUG);
				this._eventSubscribe = true;
				this._subscribeSID = response.headers.sid;
        var tiemout = this._subscriptionTimeout;
        if (!response.headers.timeout) Logger.log("Erreur de lecture du timeout lors de l'inscription au evenement, url : " + this._eventSubURL + ", response : " + JSON.stringify(response), LogType.ERROR);
				else timeout = response.headers.timeout.match(/\d+/);
				Logger.log("Inscription au evenement, url : " + this._eventSubURL + " pour " + timeout + " secondes, SID : " + this._subscribeSID);
				this._resubscribe = setTimeout((service) =>	{
					service.resubscribe();
				}, (timeout * 0.75) * 1000, this);
			}
		}
		);
	}

	resubscribe()
	{
		request(
		{
			uri: this._eventSubURL,
			method: 'SUBSCRIBE',
			headers:
			{
				'SID': this._subscribeSID,
				'TIMEOUT': 'Second-' + this._subscriptionTimeout
			}
		}, (error, response, body) =>
		{
			if (error || response.statusCode != 200)
			{
				Logger.log("Erreur de re-inscription au evenement, url : " + this._eventSubURL + " err : " + error, LogType.WARNING);
				this._eventSubscribe = false;
				delete this._subscribeSID;
				delete this._resubscribe;
				this._resubscribe = setTimeout((service) =>
				{
					service.subscribe(1);
				}, 15 * 1000, this);
				return;
			}
			else
			{
				if (!response.headers.timeout) Logger.log("Erreur de lecture du timeout lors de la ré-inscription au evenement, url : " + this._eventSubURL + ", response : " + JSON.stringify(response), LogType.ERROR);
				else this._subscriptionTimeout = response.headers.timeout.match(/\d+/);
				Logger.log("Re-inscription au evenement, url : " + this._eventSubURL + " pour " + this._subscriptionTimeout + ", header : " + JSON.stringify(response.headers));
				this._resubscribe = setTimeout((service) =>
					{
						service.resubscribe();
					}, (this._subscriptionTimeout * 0.75) * 1000, this);
			}
		}
		);
	}

	get SubscriptionID()
	{
		return this._subscribeSID
	}

	unsubscription()
	{
		if (!this._eventSubscribe)
			return;
		if (this._resubscribe)
		{
			clearTimeout(this._resubscribe);
		}
		delete this._resubscribe;

		request(
		{
			uri: this._eventSubURL,
			method: 'UNSUBSCRIBE',
			headers:
			{
				'SID': this._subscribeSID
			}
		}, (error, response, body) => {
			if (error || response.statusCode != 200)
			{
				Logger.log("Erreur de desinscription au evenement, url : " + this._eventSubURL + " err : " + error, LogType.WARNING);
        if (response && response.statusCode) Logger.log("Réponse http de la desinscription : " + JSON.stringify(response), LogType.WARNING);
			}
      else Logger.log("Desinscription au evenement, url : " + this._eventSubURL + " OK");
      this._eventSubscribe = false;
			delete this._subscribeSID;
		});
	}

	get HasEvent()
	{
		for (var i = 0 ; i < this._variables.length ; i++)
    {
      if (this._variables[i].SendEvent) return true;
    }
    return false;
	}

	ToString()
	{
		var varString = "";
		this._variables.forEach((item) =>	{	varString += item.ToString() + "\n"; });
		var actString = "";
		this._actions.forEach((item) =>	{	actString += item.ToString() + "\n"; });
		return "Service Name : " + this._name + " => \n" + varString + "\n" + actString;
	}

	executeAction(actionName, options, callback)
	{
		var action = this.getActionByName(actionName);
		if (action != null)
			action.execute(options, callback);
		else
			callback("Unable to find action " + actionName + " in service " + this.Device.UDN + "::" + this.ID, null);
	}
}

class UpnpAVTransportService extends UpnpBaseService
{
	constructor(device, serviceData, eventServer)
	{
		super(device, serviceData, eventServer);
	}

	//Fonction call for specific fonction after all initialisation
	_specializedInitialisation()
	{
		Logger.log("Specialisation for service AVTransport", LogType.Info);
		var relativeTime = this.getVariableByName("RelativeTimePosition");
		//Implémentation pour OpenHome
		if (!relativeTime)
			relativeTime = this.getVariableByName("A_ARG_TYPE_GetPositionInfo_RelTime");
		var transportState = this.getVariableByName("TransportState");
		//Implémentation pour OpenHome
		if (!transportState)
			transportState = this.getVariableByName("A_ARG_TYPE_GetTransportInfo_CurrentTransportState");

		if (transportState)
		{
			transportState.on('updated', (variable, newVal) =>
			{
				Logger.log("On transportStateUpdate : " + newVal, LogType.DEBUG);
				var actPosInfo = this.getActionByName("GetPositionInfo");
				var actMediaInfo = this.getActionByName("GetMediaInfo");
				/*
				“STOPPED” R
				“PLAYING” R
				“TRANSITIONING” O
				”PAUSED_PLAYBACK” O
				“PAUSED_RECORDING” O
				“RECORDING” O
				“NO_MEDIA_PRESENT”
				 */
				if (relativeTime && !relativeTime.SendEvent && actPosInfo)
				{
					if (this._intervalUpdateRelativeTime)
						clearInterval(this._intervalUpdateRelativeTime);
					if (newVal == "PLAYING" || newVal == "RECORDING")
					{
						actPosInfo.execute(
						{
							InstanceID: 0
						}
						);
						//Déclenche la maj toutes les 4 secondes
						this._intervalUpdateRelativeTime = setInterval(() =>
							{
								//Logger.log("On autoUpdate", LogType.DEBUG);
								actPosInfo.execute(
								{
									InstanceID: 0
								}
								);
							}, 4000);
					}
				}
				//else if (newVal == "STOPPED" || newVal == "PAUSED_PLAYBACK" || newVal == "PAUSED_RECORDING" || newVal == "NO_MEDIA_PRESENT")
				//{
				//
				//}
				//On met a jour les media info et position info pour etre sur de mettre a jour les Metadata(par defaut la freebox ne le fait pas ou plutot le fait mal)
				if (newVal == "TRANSITIONING")
				{
					if (actPosInfo)
						actPosInfo.execute(
						{
							InstanceID: 0
						}
						);
					if (actMediaInfo)
						actMediaInfo.execute(
						{
							InstanceID: 0
						}
						);
				}

				if (newVal == "STOPPED")
				{
					if (actPosInfo)
						actPosInfo.execute(
						{
							InstanceID: 0
						}
						);
					if (actMediaInfo)
						actMediaInfo.execute(
						{
							InstanceID: 0
						}
						);
				}
			}
			);
		}
	}

	//Surchage pour gerer des action complémentaire lors d'execution d'action
	executeAction(actionName, options, _callback)
	{
		//Gestion de la maj du TransportState
		var callback = _callback;

		//Fait pour gérer OpenHome qui ne met pas a jour TransportState
		if (actionName == 'Play' || actionName == 'Stop' || actionName == 'Pause' || actionName == 'SetAVTransportURI')
		{
			var transportState = this.getVariableByName("TransportState");
			//Implémentation pour OpenHome
			if (!transportState)
				transportState = this.getVariableByName("A_ARG_TYPE_GetTransportInfo_CurrentTransportState");

			if (transportState && !transportState.SendEvent)
			{
				var transportStateAction = this.getActionByName("GetTransportInfo");
				if (transportStateAction)
					callback = function ()
					{
						//On laisse le temps a l'action de s'executer complètement puis on lance la maj
						setTimeout(() =>
						{
							transportStateAction.execute(options, _callback)
						}, 1000);
					};
			}
		}

		if (actionName == 'SetAVTransportURI')
		{
			this.getActionByName('Stop').execute(options, (err, stopMessage) => {
				this.getActionByName('SetAVTransportURI').execute(options, (err, SetAVTransportURIMessage) => {
					if (err)
						callback(err, SetAVTransportURIMessage);
					else
					{
						options.Speed = 1;
						this.getActionByName('Play').execute(options, (err, PlayMessage) =>	{
							if (err)
								callback(err, PlayMessage);
							else
								this.getActionByName('GetPositionInfo').execute(options, callback);
						});
					}
				});
			});
			return;
		}

		if (actionName == 'Play')
		{
			var transportState = this.getVariableByName("TransportState");
			//Implémentation pour OpenHome
			if (!transportState)
				transportState = this.getVariableByName("A_ARG_TYPE_GetTransportInfo_CurrentTransportState");

			if (!transportState)
			{
				callback("Enable to get the TransportStatus.", null);
				retun;
			}
			if (transportState.Value != 'PAUSED_PLAYBACK' && transportState.Value != 'PLAYING')
			{
				var CurrentTrackURI = this.getVariableByName('CurrentTrackURI');
				//Implémentation pour OpenHome
				if (!CurrentTrackURI)
					CurrentTrackURI = this.getVariableByName("A_ARG_TYPE_GetPositionInfo_TrackURI");

				var CurrentTrackMetaData = this.getVariableByName('CurrentTrackMetaData');
				//Implémentation pour OpenHome
				if (!CurrentTrackMetaData)
					CurrentTrackMetaData = this.getVariableByName("A_ARG_TYPE_GetPositionInfo_TrackMetaData");

				if (CurrentTrackURI.Value != null && CurrentTrackURI.Value != '')
				{
					options.CurrentURI = CurrentTrackURI.Value;
					options.CurrentURIMetaData = XmlEntities.encode(CurrentTrackMetaData.Value);
					this.getActionByName('SetAVTransportURI').execute(options, (err, SetAVTransportURIMessage) =>	{
						if (err)
							callback(err, SetAVTransportURIMessage);
						else
							this.getActionByName('Play').execute(options, callback);
					});
				}
				else
					callback("You must select a media before start playing. No media actually available.", null);
				return;
			}
		}

		//Si pas de traitment spécifique, on lance la commande normalement
		return super.executeAction(actionName, options, callback);
	}
  
}

class OpenHomeAVTransportService extends UpnpAVTransportService
{        
  constructor(device, serviceData, eventServer)
	{
		super(device, serviceData, eventServer);
	}
  
  _initOpenHomeMap()
  {
    if (this.OpenHomePropertiesMap) return;
    this.OpenHomePropertiesMap = {
        'A_ARG_TYPE_GetTransportInfo_CurrentTransportState':'TransportState',
        'A_ARG_TYPE_GetTransportInfo_CurrentTransportStatus':'TransportStatus',
        'Unknow OpenHome Variable':'CurrentMediaCategory',
        'A_ARG_TYPE_GetMediaInfo_PlayMedium':'PlaybackStorageMedium',
        'A_ARG_TYPE_GetMediaInfo_NrTracks':'NumberOfTracks',
        'A_ARG_TYPE_GetPositionInfo_Track':'CurrentTrack',
        'A_ARG_TYPE_GetPositionInfo_TrackDuration':'CurrentTrackDuration',
        'A_ARG_TYPE_GetMediaInfo_MediaDuration':'CurrentMediaDuration',
        'A_ARG_TYPE_GetPositionInfo_TrackURI':'CurrentTrackURI',
        'A_ARG_TYPE_GetMediaInfo_CurrentURI':'AVTransportURI',
        'A_ARG_TYPE_GetPositionInfo_TrackMetaData':'CurrentTrackMetaData',
        'A_ARG_TYPE_GetMediaInfo_CurrentURIMetaData':'AVTransportURIMetaData',
        'A_ARG_TYPE_GetDeviceCapabilities_PlayMedia':'PossiblePlaybackStorageMedia',
        'A_ARG_TYPE_GetTransportSettings_PlayMode':'CurrentPlayMode',
        'A_ARG_TYPE_GetTransportInfo_CurrentSpeed':'TransportPlaySpeed',
        'A_ARG_TYPE_GetMediaInfo_NextURI':'NextAVTransportURI',
        'A_ARG_TYPE_GetMediaInfo_NextURIMetaData':'NextAVTransportURIMetaData',
        'A_ARG_TYPE_GetMediaInfo_RecordMedium':'RecordStorageMedium',
        'A_ARG_TYPE_GetDeviceCapabilities_RecMedia':'PossibleRecordStorageMedia',
        'A_ARG_TYPE_GetMediaInfo_WriteStatus':'RecordMediumWriteStatus',
        'A_ARG_TYPE_GetTransportSettings_RecQualityMode':'CurrentRecordQualityMode',
        'A_ARG_TYPE_GetDeviceCapabilities_RecQualityModes':'PossibleRecordQualityModes',
        'A_ARG_TYPE_Play_Speed':'A_ARG_TYPE_Play_Speed',
        'A_ARG_TYPE_GetPositionInfo_RelTime':'RelativeTimePosition',
        'A_ARG_TYPE_GetPositionInfo_AbsTime':'AbsoluteTimePosition',
        'A_ARG_TYPE_GetPositionInfo_RelCount':'RelativeCounterPosition',
        'A_ARG_TYPE_GetPositionInfo_AbsCount':'AbsoluteCounterPosition',
        'A_ARG_TYPE_Seek_Unit':'A_ARG_TYPE_SeekMode',
        'A_ARG_TYPE_Seek_Target':'A_ARG_TYPE_SeekTarget',
        };
  }
  
  _specializedInitialisation()
	{
    Logger.log("Specialisation for OpenHome AVTransport", LogType.Info);
    super._specializedInitialisation();
  }
  
  getVariableByName(name)
	{
    this._initOpenHomeMap();
    Logger.log("Mapping pour OpenHome de " + name + " vers " + this.OpenHomePropertiesMap[name], LogType.DEBUG);
    if (this.OpenHomePropertiesMap[name]) name = this.OpenHomePropertiesMap[name]
    for (var prop in this._variables)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (name == this._variables[prop].Name)
			{
				return this._variables[prop];
			}
		}
		Logger.log("Unable to find the variable with name " + name, LogType.DEBUG);
		return null;
	}
  
  //fromDevice == true if from device, false if from template
	processSCPD(scpd, fromDevice)
	{
		this._initOpenHomeMap();
    if (scpd.serviceStateTable[0] && scpd.serviceStateTable[0].stateVariable)
		{
			scpd.serviceStateTable[0].stateVariable.forEach((item) =>
			{
				//Modification du nom de la variabla par mapping (pour obtenir un "standard UPnP")
        Logger.log("Mapping de " + item.name[0] + " vers " + this.OpenHomePropertiesMap[item.name[0]], LogType.DEBUG);
        if (this.OpenHomePropertiesMap[item.name[0]]) item.name[0] = this.OpenHomePropertiesMap[item.name[0]];
        Logger.log("Valeur après mapping " + item.name[0], LogType.DEBUG);
        if (!this._variables.some(elem => elem.Name == item.name[0]))
				{
					var variable = new UpnpVariable(this, item, fromDevice);
					variable.on('updated', (varObj, newVal) =>
					{
						this.Device.emit('variableUpdated', varObj, newVal)
					}
					);
					this._variables.push(variable);
					this.Device.emit('variableCreated', variable);
				}
				/*else if (fromDevice){
				this._variables.filter((elem) => { return elem.Name == item.name[0]})[0].updateDefinition();
				}*/
			}
			);
		}
		else
			Logger.log("No variable found for service " + this.Device.UDN + "::" + this.ID, LogType.DEBUG);

		if (scpd.actionList[0] && scpd.actionList[0].action)
		{
			scpd.actionList[0].action.forEach((item) =>
			{
				//Si l'action n'existe pas, on la créer
				if (!this._actions.some(elem => elem.Name == item.name[0]))
				{
					var action = new UpnpAction(this, item, fromDevice);
					this._actions.push(action);
					this.Device.emit('actionCreated', action);
				}
				/*else if (fromDevice){
				this._actions.filter((elem) => { return elem.Name == item.name[0]})[0].updateDefinition();
				}*/
			}
			);
		}
		else
			Logger.log("No action found for service " + this.Device.UDN + "::" + this.ID, LogType.DEBUG);
	}
}

class WemoInsightBasicevent extends UpnpBaseService
{
  constructor(device, serviceData, eventServer)
	{
		super(device, serviceData, eventServer);
	}
  
  _specializedInitialisation()
	{
    Logger.log("Specialisation for WemoInsight Basicevent", LogType.INFO);
    //Création des infos spécifiques au Insigth decodable dans le BinaryState
    //Process serviceTemplate to Add standard commande if not exist
		var xmlTemplate = fs.readFileSync(__dirname+'/../../resources/ServicesTemplate.xml', 'utf8');
		xml2js.parseString(xmlTemplate, (err, templatesData) => {
      templatesData.servicesTemplate.serviceTemplate.forEach((serviceTemplate) => {
        if ((serviceTemplate['$']['serviceType'] == this._type || !serviceTemplate['$']['serviceType']) && 
          (serviceTemplate['$']['deviceType'] == this.Device.Type || !serviceTemplate['$']['deviceType']))
        {
          Logger.log("Processing scpd template", LogType.DEBUG);
          this.processSCPD(serviceTemplate.scpd[0],false);
          
          //On s'abonne au evenement de la variable BinaryState pour en faire le decodage
          var binaryState = this.getVariableByName('BinaryState');
          if (!binaryState)
          {
            Logger.log("Unable to find BinaryState variable of the Wemo Insight " + this.Device.BaseAddress, LogType.ERROR);
            return;
          }
          binaryState.on('updated', (varObj, newVal) =>	{
						//On split la variable pour definir les valeurs des sous variable
            var subVariables = newVal.split('|');      
        
            if (subVariables[0]) this.updateSubVariable('State',Number(subVariables[0]));
            if (subVariables[0] == '0') this.updateSubVariable('HumanState','Off');
            if (subVariables[0] == '1') this.updateSubVariable('HumanState','On');
            if (subVariables[0] == '2') this.updateSubVariable('HumanState','OnWithoutLoad');
            if (subVariables[1]) this.updateSubVariable('LastModify',Number(subVariables[1]));
            if (subVariables[2]) this.updateSubVariable('OnFor',Number(subVariables[2]));
            if (subVariables[3]) this.updateSubVariable('OnToday',Number(subVariables[3]));
            if (subVariables[4]) this.updateSubVariable('OnTotal',Number(subVariables[4]));
            if (subVariables[5]) this.updateSubVariable('TimePeriod',Number(subVariables[5]));
            if (subVariables[6]) this.updateSubVariable('WifiStrength',Number(subVariables[6]));
            if (subVariables[7]) this.updateSubVariable('Power',Number(subVariables[7])*0.001); //conversion mW en W
            if (subVariables[8]) this.updateSubVariable('TodayComsuption',Number(subVariables[8])*0.001*(1/60)); //conversion mW*minutes en KWh
            if (subVariables[9]) this.updateSubVariable('TotalComsuption',Number(subVariables[9])*0.001*(1/60)); //conversion mW*minutes en KWh
            if (subVariables[10]) this.updateSubVariable('PowerThreshold',Number(subVariables[10])*0.001); //conversion mW en W??? 
					});
        }
      });
		});  
  }
  
  updateSubVariable(name, value)
  {
    var variable = this.getVariableByName(name);
    if (!variable)
    {
      Logger.log("Unable to find BinaryState variable of the Wemo Insight " + this.Device.BaseAddress, LogType.ERROR);
      return;
    }
    variable.Value = value;
  }
}

class WemoMakerDeviceevent extends UpnpBaseService
{
  constructor(device, serviceData, eventServer)
	{
		super(device, serviceData, eventServer);
	}
  
  //On ne traite pas le xml du device mais un template car celui du device n'est pas correct
  _processDeviceSCPD(callback)
  {
		Logger.log("Specialisation for WemoMaker Deviceevent", LogType.INFO);
    //Création des infos spécifiques au Maker decodable dans le attributeList
		var xmlTemplate = fs.readFileSync(__dirname+'/../../resources/ServicesTemplate.xml', 'utf8');
		xml2js.parseString(xmlTemplate, (err, templatesData) => {
      templatesData.servicesTemplate.serviceTemplate.forEach((serviceTemplate) => {
        if ((serviceTemplate['$']['serviceType'] == this._type || !serviceTemplate['$']['serviceType']) && 
          (serviceTemplate['$']['deviceType'] == this.Device.Type || !serviceTemplate['$']['deviceType']))
        {
          Logger.log("Processing scpd template", LogType.DEBUG);
          this.processSCPD(serviceTemplate.scpd[0],false);
          
          //On s'abonne au evenement de la variable attributeList pour en faire le decodage
          var attributeList = this.getVariableByName('attributeList');
          if (!attributeList)
          {
            Logger.log("Unable to find attributeList variable of the Wemo Maker " + this.Device.BaseAddress, LogType.ERROR);
            return;
          }
          attributeList.on('updated', (varObj, newVal) =>	{
            xml2js.parseString("<AttributeList>"+XmlEntities.decode(newVal)+"</AttributeList>", (err, parsed) => {
              if (err)
              {
                Logger.log("Unable to parse xml (bad format? : " + err, LogType.DEBUG);
              }
              else
              {
                parsed.AttributeList.attribute.forEach((attr) => {
                  var variable = this.getVariableByName(attr.name[0]);
                  if (variable)
                  {
                    variable.Value = attr.value[0];
                    if (attr.name[0] == 'SwitchMode')
                    {
                      var humanVariable = this.getVariableByName('Human'+attr.name[0]);
                      if (attr.value[0] == '0') humanVariable.Value = 'OnOff';
                      else humanVariable.Value = 'Momentary';
                    }
                  }
                  else
                  {
                    Logger.log("Unable to find " + attr.name[0] + " variable of the Wemo Maker " + this.Device.BaseAddress, LogType.ERROR);
                  }
                  
                });
              }
            });
					});
        }
      });
      if (this._eventSubURL != '/') this.subscribe();	
		});  
  }
}

exports.BaseService = UpnpBaseService;
exports.AVTransportService = UpnpAVTransportService;
exports.OpenHomeAVTransportService = OpenHomeAVTransportService;
exports.WemoInsightBasicevent = WemoInsightBasicevent;
exports.WemoMakerDeviceevent = WemoMakerDeviceevent;
