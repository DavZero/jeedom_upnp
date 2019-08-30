"use strict";

var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var UpnpService = require('./upnp_service.js');
var EventEmitter = require('events');

class UpnpDevice extends EventEmitter
{
	constructor(uuid, includeState, allowedServices, timeout, location, deviceDescription, eventServer)
	{
		super();

		Logger.log("Creation du device " + deviceDescription.deviceType[0] + " " + uuid);
    this._UDN = uuid;
    this._setDeviceTimeout(timeout);
		this._updateDeviceProperties(location, deviceDescription);
    this._services = {};
    this._includeState = includeState;
    this._allowedServices = [];
    if (allowedServices) this._allowedServices = allowedServices;
    //On créer les services mais il faut laisser le temps au controlPoint de s'inscrire au evenement
    //setTimeout(() => {
    //  this._updateServices(deviceDescription,eventServer);
    //},1000);
    process.nextTick(() => { this._updateServices(deviceDescription,eventServer); });
	}

  _updateServices(deviceDescription, eventServer)
  {
    var serviceList = [];
    if (deviceDescription.serviceList && deviceDescription.serviceList[0] && deviceDescription.serviceList[0].service)
		{
      deviceDescription.serviceList[0].service.forEach((item) => {
        //Si le service est autorisé on le créer (on ignore urn:dial­multiscreen­org:service:dial:1)
        try
        {
          if ((this._includeState || this._allowedServices.indexOf(item.serviceId[0]) !== -1) && item.serviceType[0] != 'urn:dial­multiscreen­org:service:dial:1' )
          {
            if (this._services[item.serviceId[0]]) this._services[item.serviceId[0]].update(item);
            else
            {
              this._services[item.serviceId[0]] = this._createService(item, eventServer);
              if (this._allowedServices.indexOf(item.serviceId[0]) === -1) this._allowedServices.push(item.serviceId[0]);
            }
            serviceList.push(item.serviceId[0]);
            this.emit('serviceUpdated', this._services[item.serviceId[0]]);
          }
        }
        catch (e)
        {
          Logger.log("Unable to create/update service " + JSON.stringify(item) + " err : " + e, LogType.DEBUG);
        }
			});
		}
    else
      Logger.log("No service list found for device" + this._UDN + " adresse : " + this._location.href + " : " + JSON.stringify(deviceDescription), LogType.DEBUG);

    //On supprime les services qui n'existe plus
    for (var prop in this._services)
    {
      if (serviceList.indexOf(prop) === -1)
      {
        this._services[prop].prepareForRemove();
        delete this._services[prop];
      }
    }
  }

  setIncludeState(includeState)
  {
    this._includeState = includeState;
  }

  _updateDeviceProperties(location, deviceDescription)
  {
    this._type = deviceDescription.deviceType[0];
		this._location = location;
		this._name = deviceDescription.friendlyName[0];
		this._iconUrl = '';
		this._additionalInfo = {};

    //Manage additional properties
		for (var prop in deviceDescription)
		{
			if (prop != 'deviceType' && prop != 'friendlyName' && prop != 'serviceList' && prop != 'UDN' && prop != 'deviceList' && prop != 'iconList')
				this._additionalInfo[prop] = deviceDescription[prop][0];
    }

		//Récuparation de l'icone
		if (deviceDescription.iconList)
		{
			var maxSize = 0
      deviceDescription.iconList[0].icon.forEach((item) =>	{
				if (item.mimetype[0] == 'image/png' && parseInt(item.width[0]) > maxSize)
				{
					if (item.url[0].charAt(0) == '/') this._iconUrl = this.BaseAddress + item.url[0];
          else this._iconUrl = this.BaseAddress + '/' + item.url[0];
          maxSize = parseInt(item.width[0]);
				}
			});
		}
  }

  update(timeout, location, deviceDescription, eventServer)
  {
    Logger.log("Mise a jour du device " + deviceDescription.deviceType[0] + " " + this._UDN + " / timeout : " + timeout, LogType.DEBUG);
    this._setDeviceTimeout(timeout);
    this._updateDeviceProperties(location, deviceDescription);
    //process.nextTick(() => { this._updateServices(deviceDescription,eventServer); });
    //setTimeout(() => {
    //  this._updateServices(deviceDescription,eventServer);
  //},1000);
    this._updateServices(deviceDescription, eventServer);
  }

  setAllowedService(allowedServices)
  {
    this._allowedServices = allowedServices;
  }

  _createService(serviceDescription, eventServer)
  {
    var service;
    Logger.log("Create Service for " + this._type + " : " + JSON.stringify(serviceDescription));
    if (this._type == 'urn:Belkin:device:insight:1' && serviceDescription.serviceType[0] == 'urn:Belkin:service:basicevent:1')
    {
      //Création d'un service spécial pour le WEMO Insight
      service = new UpnpService.WemoInsightBasicevent(this, serviceDescription, eventServer);
    }
    else if (this._type == 'urn:Belkin:device:insight:1' && serviceDescription.serviceType[0] == 'urn:Belkin:service:insight:1')
    {
      //Création d'un service spécial pour le WEMO Insight
      service = new UpnpService.WemoInsightService(this, serviceDescription, eventServer);
    }
    else if (this._type == 'urn:Belkin:device:Maker:1' && serviceDescription.serviceType[0] == 'urn:Belkin:service:deviceevent:1')
    {
      //Création d'un service spécial pour le WEMO Maker
      service = new UpnpService.WemoMakerDeviceevent(this, serviceDescription, eventServer);
    }
    else if (serviceDescription.serviceType[0].indexOf(":AVTransport") !== -1 && this._additionalInfo['manufacturer'] == 'OpenHome')
      service = new UpnpService.OpenHomeAVTransportService(this, serviceDescription, eventServer);
		else if (serviceDescription.serviceType[0].indexOf(":AVTransport") !== -1)
      service = new UpnpService.AVTransportService(this, serviceDescription, eventServer);
		else
			service = new UpnpService.BaseService(this, serviceDescription, eventServer);
    return service;
  }

  _setDeviceTimeout(timeout)
  {
    if (this._checkAlive) clearTimeout(this._checkAlive);
    this._checkAlive = setTimeout((device) => {
      Logger.log("Device " + this._UDN + " adresse : " + this._location.href + " alive timeout reach", LogType.DEBUG);
      device.emit('deviceAliveTimeout',device);
    },timeout*1100,this);
  }

	alreadyExistMessage()
	{
		Logger.log("Device already exist " + this._UDN + " adresse : " + this._location.href, LogType.DEBUG);
	}

	get IconUrl()
	{
		return this._iconUrl;
	}

	prepareForRemove()
	{
		Logger.log("Suppression du device " + this._UDN);
    if (this._checkAlive) clearTimeout(this._checkAlive);
		//Il faut supprimer tout les services et notamment faire UNSUBSCRIBE
    for (var prop in this._services)
    {
      this._services[prop].prepareForRemove();
    }
	}

  removeService(serviceID)
  {
    if (this._services[serviceID])
    {
      this._services[serviceID].prepareForRemove();
      delete this._services[serviceID];
    }
  }

	get BaseAddress()
	{
		//Logger.log(JSON.stringify(this._location));
		return this._location.protocol + (this._location.slashes ? "//" : "") + this._location.host;
	}

	get Location()
	{
		return this._location;
	}

	get UDN()
	{
		return this._UDN;
	}

  get Type()
	{
		return this._type;
	}

	get Name()
	{
		return this._name;
	}

	get AdditionalInformation()
	{
		return this._additionalInfo;
	}

	get Services()
	{
		return this._services;
	}

	getServiceBySubscriptionID(subscriptionID)
	{
		for (var prop in this._services)
		{
			//console.log("in Device : obj." + prop + " = " + this._services[prop] + "/" + this._services[prop].SubscriptionID);
			if (subscriptionID == this._services[prop].SubscriptionID)
			{
				return this._services[prop];
			}
		}
	}

	getService(serviceID)
	{
    if (this._services[serviceID]) return this._services[serviceID];
		Logger.log("Unable to find the service with ID " + serviceID, LogType.DEBUG);
		return;
	}

	ToString()
	{
		var serviceString = "";
		this._services.forEach((item) => {	serviceString += item.ToString() + "\n"; });

		return "Device Name : " + this._name + " => \n" + serviceString;
	}
}

exports.UpnpDevice = UpnpDevice;
