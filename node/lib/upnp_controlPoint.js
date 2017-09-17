"use strict";

var ssdpAPI = require("./ssdp.js");
var upnpDeviceAPI = require('./upnp_device');
var http = require("http");
var EventEmitter = require('events');
var url = require('url');
var request = require('request');
var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var portfinder = require('portfinder');
var ip = require('ip');
var xml2js = require('xml2js');

ip.address() // my ip address

function getUUID(usn) 
{
  var udn = usn;
  var s = usn.split("::");
  if (s.length > 0) udn = s[0];
  if (udn.startsWith("uuid:"))  udn = udn.substring(5);
  return udn;
};

function getDeviceDescriptionByUUID(description, uuid)
{
  //Logger.log("Compare " + getUUID(description.UDN[0]) + " with " + uuid);
  if (getUUID(description.UDN[0]) == uuid) return description;
  if (description.deviceList && description.deviceList[0] && description.deviceList[0].device)
  {
    var items = description.deviceList[0].device;
    for (var i = 0; i < items.length; i++) 
    {
      var subDevice = getDeviceDescriptionByUUID(items[i],uuid);
      if (subDevice) return subDevice;
    }
  }    
  return;
}

var debug;
if (process.env.NODE_DEBUG && /upnp/.test(process.env.NODE_DEBUG))
{
	debug = function (x)
	{
		console.error('UPNP-CONTROLPOINT: %s', x);
	};
}
else
{
	debug = function ()  {};
}

class ControlPoint extends EventEmitter
{
	constructor(ssdpPort, allowedDevice, disallowedDevice)
	{
		super();
    
    this._includeState = false;

		//On créer un serveur http pour gérer les events
		portfinder.getPort((err, port) => {
			this._eventPort = port;
			this._eventServer = http.createServer((request, response) =>
      {
				response.writeHead(200);
				response.end();
				var headers = request.headers;
				var method = request.method;
				var url = request.url;
				var body = [];
				request.on('error', (err) =>{
					console.error(err);
				}
        ).on('data', (chunk) =>	{	body.push(chunk);	}
				).on('end', () =>	{
					body = Buffer.concat(body).toString();
					Logger.log("Event header: " + JSON.stringify(headers) + " receive, search for service", LogType.DEBUG);
					Logger.log("Event body: " + body + " receive, search for service", LogType.DEBUG);
					var service = this.getServiceBySID(headers.sid);
					if (service)
					{
						Logger.log("Service " + service.Device.UDN + '::' + service.ID + " found.", LogType.DEBUG);
            //Traitement pour corriger certain xml mal formatter uniquement si le xml ne contient pas de CDATA
            if (body.indexOf("<![CDATA[") === -1) body = body.replace(/&(?!amp;|gt;|lt;|apos;|quot;|#\d+;)/gi, "&amp;");
						xml2js.parseString(body, (err, data) =>
						{
							//Manage error
							if (err)
							{
								Logger.log("Error processing Event : " + service.Device.UDN + '::' + service.ID + " ==> xml : " + body + ", err : " + err, LogType.ERROR);
								this.emit('upnpError', "Error processing Event : " + service.Device.UDN + '::' + service.ID + " ==> xml : " + body + ", err : " + err);
							}
							else
							{
                service.processEvent(data);
							}
						});
					}
				});
			});
			this._eventServer.listen(port);
		});
    
		//On créer un serveur pour gérer le ssdp
		this._SSDPserver = new ssdpAPI.SSDP(ssdpPort);
		this._SSDPserver.startServer((msg, rinfo) => {	this._onSSDPMessage(msg, rinfo); });
		//Initiliastion de la liste des devices
    //Gestion de la liste des périphériques autorisés
    this._allowedDevice = {};
    if (allowedDevice) this._allowedDevice = allowedDevice;
    this._disallowedDevice = [];
    if (disallowedDevice) this._disallowedDevice = disallowedDevice;
		this._devices = {};
		this._requestedDeviceQueue = {};
	}
 
	shutdown()
	{
		try
		{
			this._SSDPserver.stopServer();
		}
		catch (e)
		{
			Logger.log("Error stopping SSDP server ??? : " + e, LogType.WARNING);
		}
		this._eventServer.close();
		for (var prop in this._devices)
		{
			this._removeDevice(prop);
		}
		Logger.log("Control point stopped.", LogType.DEBUG);
	}

	search(st)
	{
		Logger.log("Start searching request for " + (typeof st === 'undefined' ? 'All' : st), LogType.INFO);
		this._SSDPserver.sendMSearch(st, (msg, rinfo) =>	{	this._onMSearchMessage(msg, rinfo);	});
	}

	_onSSDPMessage(msg, rinfo)
	{
		if (msg.getMethod() == 'NOTIFY')
		{
			var headers = msg.getHeaders();
			switch (ssdpAPI.NTS_EVENTS[headers.NTS])
			{
        case 'DeviceAvailable':
          this._addDevice(headers);
          break;
        case 'DeviceUpdate':
          this._updateDevice(headers);
          break;
        case 'DeviceUnavailable':
          //On cherche le device qui a le bon usn et on le supprimer
          Logger.log("Device " + getUUID(headers.USN) + " send ssdp:byebye message", LogType.DEBUG);
          this._removeDevice(getUUID(headers.USN));
          break;
			}
		}
	}

	_onMSearchMessage(msg, rinfo)
	{
		this._addDevice(msg.getHeaders());
	}

	_updateDevice(location)
	{
		location.port = location.port || (location.protocol == "https:" ? 443 : 80);
		/*if (!this._devices[location.href]){
		//this._devices[location.href].alreadyExistMessage();
		return;
		}*/
		Logger.log("UPDATE DEVICE NOT IMPLEMENTED", LogType.ERROR);
	}
   
  _isDisallowed(uuid)
  {  
    return this._disallowedDevice.indexOf(uuid) === -1 ? false : true;
  }
  
  _removeAllowed(uuid, serviceID)
  {
    if (this._allowedDevice[uuid] && this._allowedDevice[uuid].indexOf(serviceID) !== -1) this._allowedDevice[uuid].splice(this._allowedDevice[uuid].indexOf(serviceID),1);
    if (this._devices[uuid]) this._devices[uuid].setAllowedService(this._allowedDevice[uuid]);
    if (this._allowedDevice[uuid].length == 0) delete this._allowedDevice[uuid];
  }
  
  _addAllowedService(uuid, serviceID)
  {
    if (!this._allowedDevice[uuid]) this._allowedDevice[uuid] = [];
    if (this._allowedDevice[uuid].indexOf(serviceID) === -1) this._allowedDevice[uuid].push(serviceID);
  }

	_addDevice(headers)
	{
    Logger.log("Process usn : " + headers.USN, LogType.DEBUG);
    var uuid = getUUID(headers.USN);
    //Si le device n'est pas autorisés
    if (this._isDisallowed(uuid)) return;
    if (!this._includeState) 
    {
      if (!this._allowedDevice[uuid]) return;
    }
    var timeout = headers['CACHE-CONTROL'].match(/\d+/);
    var location = url.parse(headers.LOCATION);
    location.port = location.port || (location.protocol == "https:" ? 443 : 80);
		if (this._requestedDeviceQueue[uuid])
		{
			Logger.log("Device " + uuid + " with location " + location.href + " already queued for creation/update", LogType.DEBUG);
			return;
		}
    
		this._requestedDeviceQueue[uuid] = location.href;
		Logger.log("Add Device " + uuid + " with location " + location.href + " to ceation/update queued", LogType.DEBUG);

		// Retrieve device/service/... description
		request(location.href, (error, response, body) =>	{
			if (error || response.statusCode != 200)
      {
        //ToDo Logging error
      }
			else
			{
        xml2js.parseString(body, (err, data) =>
				{
          if (!err && data && data.root && data.root.device)
          {
            //Recherche du device correspondant à la description (pour rechercher les embedded device)
            var deviceDescription = getDeviceDescriptionByUUID(data.root.device[0],uuid);
            if (deviceDescription)
            {
              //Si le device existe deja.
              if (this._devices[uuid])
              {
                //this._devices[uuid].setDeviceTimeout(timeout);
                //On met a jour le device notament l'adresse au cas ou
                this._devices[uuid].update(timeout, location, deviceDescription, 'http://' + ip.address() + ':' + this._eventPort);
              }
              else
              {
                this._devices[uuid] = new upnpDeviceAPI.UpnpDevice(uuid, this._includeState, this._allowedDevice[uuid], timeout, location, deviceDescription, 'http://' + ip.address() + ':' + this._eventPort);
                this._devices[uuid].on('serviceUpdated', (service) => { 
                  this.emit('serviceUpdated', service); 
                  //On ajoute le service a la liste des services autorisés
                  this._addAllowedService(service.Device.UDN,service.ID);
                });
                this._devices[uuid].on('actionCreated', (action) => { this.emit('actionDiscovered', action); });
                this._devices[uuid].on('variableCreated', (variable) => { this.emit('variableDiscovered', variable); });
                this._devices[uuid].on('variableUpdated', (variable, newVal) => { this.emit('variableUpdated', variable, newVal); });
                this._devices[uuid].on('serviceOffline', (service) => { this.emit('serviceOffline', service); });
                this._devices[uuid].on('deviceAliveTimeout', (device) => { 
                  //Check if device is alive or not and remove it if not
                  this._SSDPserver.sendMSearch('uuid:'+device.UDN, (msg, rinfo) =>	{	this._onMSearchMessage(msg, rinfo);	});
                  //On laisse le temps au device de répondre et sinon on le supprime
                  setTimeout((device) => { 
                    if (!device.IsAlive) 
                    {
                      Logger.log("Device " + device.UDN + " was not alive anymore", LogType.DEBUG);
                      this._removeDevice(device.UDN);
                    }
                  },5000,device);
                });
                this._devices[uuid].on('error', (error) => { this.emit('upnpError', error); });
              }
              //On l'ajoute a la liste des autorisés
              if (!this._allowedDevice[uuid]) this._allowedDevice[uuid] = ["All"];
            }
            else 
            { 
              //Manage error
            }
          }
          else
          {
            Logger.log("Unable to parse xml or get device attribute xml : " + body + ", json : " + JSON.stringify(data) + ", err : " + err, LogType.WARNING);
          }
				});
			}
			//On supprime la requete d'ajout au bout de 5 secondes (inutile de retraiter la création/mise a jour avant 5 seconde)
      setTimeout(() => { delete this._requestedDeviceQueue[uuid]; },5000);
		});
	}

	_removeDevice(uuid)
	{
    if (this._devices[uuid])
    {
      this._devices[uuid].prepareForRemove();
			delete this._devices[uuid];
    }
	}
  
  removeAllowedService(uuid,serviceID)
  {
    this._removeAllowed(uuid,serviceID);
    this.removeService(uuid,serviceID);
  }
  
  setIncludeState(val)
  {
    if (val) this._includeState = true;
    else this._includeState = false;
    
    for (var prop in this._devices)
		{
			this._devices[prop].setIncludeState(this._includeState);
		}
  }

	getService(udn, serviceID)
	{
		var device = this.getDevice(udn);
		if (device == null)
			return;
		return device.getService(serviceID);
	}
  
  removeService(udn, serviceID)
  {
    var device = this.getDevice(udn);
    if (device)
    {
      device.removeService(serviceID);
      //Si il n'y a plus de service on supprime le device
      if (Object.keys(device.Services).length == 0) 
      {
        this._devices[getUUID(udn)].prepareForRemove();
        delete this._devices[getUUID(udn)];
      }
    }
  }

	getServiceBySID(subscriptionID)
	{
		for (var prop in this._devices)
		{
			//console.log("in CP : obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			var service = this._devices[prop].getServiceBySubscriptionID(subscriptionID);
			if (service)
				return service;
		}
		Logger.log("Unable to find the service with SID " + subscriptionID, LogType.WARNING);
	}

	getDevice(udn)
	{
		if (this._devices[getUUID(udn)]) return this._devices[getUUID(udn)];
		Logger.log("Unable to find the device " + udn, LogType.ERROR);
	}
}

exports.ControlPoint = ControlPoint;
