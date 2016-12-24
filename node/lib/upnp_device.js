"use strict";

var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var UpnpService = require('./upnp_service.js');
var EventEmitter = require('events');

class UpnpDevice extends EventEmitter
{
	constructor(location, device, eventServer)
	{
		super();

		Logger.log("Creation du device " + device.deviceType[0] + " " + device.UDN[0])
		this._type = device.deviceType[0];
		this._UDN = device.UDN[0];
		this._location = location;
		this._name = device.friendlyName[0];
		this._iconUrl = '';
		this._services = [];
		this._subDevices = [];
		this._additionalInfo = {};

		//Manage additional properties
		for (var prop in device)
		{
			if (prop != 'deviceType' && prop != 'friendlyName' && prop != 'serviceList' && prop != 'UDN' && prop != 'deviceList' && prop != 'iconList')
				this._additionalInfo[prop] = device[prop][0];
        }

		//Récuparation de l'icone
		//{"mimetype":["image/png"],"url":["/icons/sm.png"],"width":["48"],"height":["48"],"depth":["24"]},{"mimetype":["image/png"],"url":["/icons/lrg.png"],"width":["120"],"height":["120"],"depth":["24"]},{"mimetype":["image/jpeg"],"url":["/icons/sm.jpg"],"width":["48"],"height":["48"],"depth":["24"]},{"mimetype":["image/jpeg"],"url":["/icons/lrg.jpg"],"width":["120"],"height":["120"],"depth":["24"]}
		if (device.iconList)
		{
			device.iconList[0].icon.forEach((item) =>
			{
				if (item.mimetype[0] == 'image/png' && parseInt(item.width[0]) > 100)
				{
					if (item.url[0].charAt(0) == '/') this._iconUrl = this.BaseAddress + item.url[0];
          else this._iconUrl = this.BaseAddress + '/' + item.url[0];
				}
			});
		}

		//Gestion des subDevice
		if (device.deviceList && device.deviceList[0] && device.deviceList[0].device)
		{
			device.deviceList[0].device.forEach((item) =>	{
				var subDevice = new UpnpDevice(location, item, eventServer);
				subDevice.on('serviceUpdated', (service) =>	{	this.emit('serviceUpdated', service); });
				subDevice.on('actionCreated', (action) =>	{	this.emit('actionCreated', action); });
				subDevice.on('variableCreated', (variable) =>	{	this.emit('variableCreated', variable);	});
				subDevice.on('variableUpdated', (variable, newVal) =>	{	this.emit('variableUpdated', variable, newVal);	});
				subDevice.on('error', (error) => { this.emit('error', error);	});
				this._subDevices.push(subDevice);
			});
		}

		if (device.serviceList && device.serviceList[0] && device.serviceList[0].service)
		{
			//On lance la fonction en timeout de facon a laisser le controlpoint s'abonner au message avant qu'il ne soit emis
			setTimeout(() =>
			{
				device.serviceList[0].service.forEach((item) =>
				{
					//Logger.log("debug service création : " + JSON.stringify(item.serviceType[0]), LogType.DEBUG);
					var service;
          //if (device['manufacturer'])
          //  Logger.log("debug service for manufacturer : " + JSON.stringify(device['manufacturer'][0]), LogType.DEBUG);
          if (this._type == 'urn:Belkin:device:insight:1' && item.serviceType[0] == 'urn:Belkin:service:basicevent:1')
          {
            //Création d'un service spécial pour le WEMO Insight
            service = new UpnpService.WemoInsightBasicevent(this, item, eventServer);
          }
          else if (this._type == 'urn:Belkin:device:Maker:1' && item.serviceType[0] == 'urn:Belkin:service:deviceevent:1')
          {
            //Création d'un service spécial pour le WEMO Maker
            service = new UpnpService.WemoMakerDeviceevent(this, item, eventServer);
          }
          else if (item.serviceType[0].indexOf(":AVTransport") !== -1 && device['manufacturer'] && device['manufacturer'][0] == 'OpenHome')
            service = new UpnpService.OpenHomeAVTransportService(this, item, eventServer);
					else if (item.serviceType[0].indexOf(":AVTransport") !== -1)
						service = new UpnpService.AVTransportService(this, item, eventServer);
					else
						service = new UpnpService.BaseService(this, item, eventServer);
					this._services.push(service);
					this.emit('serviceUpdated', service);
				}
				);
			}, 1500);
		}
		else
		{
			Logger.log("No service list found for device" + this._UDN + " adresse : " + this._location.href + " : " + JSON.stringify(device), LogType.DEBUG);
		}
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
		//Il faut supprimer tout les services et notament faire UNSUBSCRIBE
		this._services.forEach((item) =>
		{
			item.prepareForRemove();
		}
		);
	}
  
  removeDirectService(serviceID)
  {
    for (var prop in this._services)
		{
			if (serviceID == this._services[prop].ID)
			{
				this._services[prop].prepareForRemove();
        delete this._services[prop];
        return;
			}
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

	getDeviceOrSubDevice(udn)
	{
		if (this.UDN == udn)
			return this;
		else
		{
			for (var prop in this._subDevices)
			{
				var selectedDevice = this._subDevices[prop].getDeviceOrSubDevice(udn);
				if (selectedDevice)
					return selectedDevice;
			}
		}
	}

	getServiceOrSubServiceBySubscriptionID(subscriptionID)
	{
		for (var prop in this._services)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (subscriptionID == this._services[prop].SubscriptionID)
			{
				return this._services[prop];
			}
		}
		for (var prop in this._subDevices)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			var service = this._subDevices[prop].getServiceOrSubServiceBySubscriptionID(subscriptionID);
			if (service)
				return service;
		}
	}

	getDirectService(serviceID)
	{
		for (var prop in this._services)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (serviceID == this._services[prop].ID)
			{
				return this._services[prop];
			}
		}
		Logger.log("Unable to find the service with ID " + serviceID, LogType.DEBUG);
		return null;
	}

	ToString()
	{
		var serviceString = "";
		this._services.forEach((item) => {	serviceString += item.ToString() + "\n"; });

		return "Device Name : " + this._name + " => \n" + serviceString;
	}
}

exports.UpnpDevice = UpnpDevice;
