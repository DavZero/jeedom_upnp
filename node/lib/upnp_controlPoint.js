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
//var XmlEntities = require('html-entities').XmlEntities;

ip.address() // my ip address

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
	constructor(ssdpPort)
	{
		super();

		//On créer un serveur http pour gérer les events
		portfinder.getPort((err, port) =>
		{
			this._eventPort = port;
			this._eventServer = http.createServer((request, response) =>
				{
					response.writeHead(200);
					response.end();
					var headers = request.headers;
					var method = request.method;
					var url = request.url;
					var body = [];
					request.on('error', (err) =>
					{
						console.error(err);
					}
					).on('data', (chunk) =>
					{
						body.push(chunk);
					}
					).on('end', () =>
					{
						body = Buffer.concat(body).toString();
						Logger.log("Event header: " + JSON.stringify(headers) + " receive, search for service", LogType.DEBUG);
						Logger.log("Event body: " + body + " receive, search for service", LogType.DEBUG);
						var service = this.getServiceBySID(headers.sid);
						if (service)
						{
							Logger.log("Service found.", LogType.DEBUG);
							xml2js.parseString(body, (err, data) =>
							{
								//Manage error
								if (err)
								{
									Logger.log("Error processing Event : " + service.Device.UDN + '::' + service.ID + " ==> xml : " + body + ", err : " + err, LogType.ERROR);
									this.emit('error', "Error processing Event : " + service.Device.UDN + '::' + service.ID + " ==> xml : " + body + ", err : " + err);
								}
								else
								{
									service.processEvent(data);
								}
							}
							);
						}
					}
					);
				}
				);
			this._eventServer.listen(port);
		}
		);

		//On créer un serveur pour gérer le ssdp
		this._SSDPserver = new ssdpAPI.SSDP(ssdpPort);
		this._SSDPserver.startServer((msg, rinfo) =>
		{
			this._onSSDPMessage(msg, rinfo);
		}
		);
		//Initiliastion de la liste des devices
    this._blackList = {};
		this._devices = {};
		this._requestedDeviceQueue = {};
	}
  
  purgeBlackList()
  {
    this._blackList = {};
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
			this._devices[prop].prepareForRemove();
			delete this._devices[prop];
		}
		Logger.log("Control point stopped.", LogType.DEBUG);
	}

	search(st)
	{
		Logger.log("Start searching request for " + (typeof st === 'undefined' ? 'All' : st), LogType.INFO);
		this._SSDPserver.sendMSearch(st, (msg, rinfo) =>
		{
			this._onMSearchMessage(msg, rinfo);
		}
		);
	}

	_onSSDPMessage(msg, rinfo)
	{
		//Logger.log(JSON.stringify(msg.getHeaders()),LogType.DEBUG);
		//Logger.log(JSON.stringify(msg.getMethod()),LogType.DEBUG);
		//Logger.log(JSON.stringify(rinfo),LogType.DEBUG);
		if (msg.getMethod() == 'NOTIFY')
		{
			var headers = msg.getHeaders();
			//this.emit(ssdpAPI.NTS_EVENTS[headers.NTS],headers);
			switch (ssdpAPI.NTS_EVENTS[headers.NTS])
			{
        case 'DeviceAvailable':
				this._addDevice(url.parse(headers.LOCATION));
				break;
			case 'DeviceUpdate':
				this._updateDevice(url.parse(headers.LOCATION));
				break;
			case 'DeviceUnavailable':
				//On cherche le device qui a le bon usn et on le supprimer
				this._removeDevice(headers.USN);
				break;
			}
		}
	}

	_onMSearchMessage(msg, rinfo)
	{
		var headers = msg.getHeaders();
		//this.emit('DeviceFound',headers);
		this._addDevice(url.parse(headers.LOCATION));
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

	_addDevice(location)
	{
		location.port = location.port || (location.protocol == "https:" ? 443 : 80);
		// Early return if this location is already processed
		if (this._devices[location.href])
		{
			this._devices[location.href].alreadyExistMessage();
			return;
		}
		if (this._requestedDeviceQueue[location.href])
		{
			Logger.log("Device " + location.href + " already queued for creation", LogType.DEBUG);
			return;
		}
		this._requestedDeviceQueue[location.href] = 'Queued';
		Logger.log("Add Device " + location.href + " to ceation queued", LogType.DEBUG);

		// Retrieve device/service/... description
		request(location.href, (error, response, body) =>
		{
			if (error || response.statusCode != 200)
      {
				if (!this._blackList[location.href]) this._blackList[location.href] = 1;
        if (this._blackList[location.href] < 5)
        {
          var remainsTry = 5-this._blackList[location.href];
          Logger.log('Unable to add ' + location.href + ' remains  ' + remainsTry.toString() + ' tries, ' + error, LogType.WARNING);
          this._blackList[location.href]++;
        }
        else if (this._blackList[location.href] == 5)
        {
          Logger.log('Unable to add ' + location.href + ', ' + error, LogType.ERROR);
          this.emit('upnpError', 'Unable to add ' + location.href + ', ' + error);
          this._blackList[location.href]++;
        }
        else this._blackList[location.href]++;  
      }
			else
			{
				if (this._blackList[location.href]) delete this._blackList[location.href];
        xml2js.parseString(body, (err, data) =>
				{
					//LogDate(logType.INFO, JSON.stringify(data));
					/*this._devices[location.href] = new upnpDeviceAPI.UpnpDevice(location, data,(device) => {
					device.subscribeServicesEvents('http://' + ip.address() + ':' + this._eventPort);
					}));*/
          if (!err && data && data.root && data.root.device)
          {
            this._devices[location.href] = new upnpDeviceAPI.UpnpDevice(location, data.root.device[0], 'http://' + ip.address() + ':' + this._eventPort);
            this._devices[location.href].on('serviceUpdated', (service) => { this.emit('serviceUpdated', service); });
            this._devices[location.href].on('actionCreated', (action) => { this.emit('actionDiscovered', action); });
            this._devices[location.href].on('variableCreated', (variable) => { this.emit('variableDiscovered', variable); });
            this._devices[location.href].on('variableUpdated', (variable, newVal) => { this.emit('variableUpdated', variable, newVal); });
            this._devices[location.href].on('serviceOffline', (service) => { this.emit('serviceOffline', service); });
            this._devices[location.href].on('error', (error) => { this.emit('upnpError', error); });
          }
          else
          {
            Logger.log("Unable to parse xml or get device attribute xml : " + body + ", json : " + JSON.stringify(data) + ", err : " + err, LogType.WARNING);
          }
				});
			}
			delete this._requestedDeviceQueue[location.href];
		}
		);
	}

	_removeDevice(usn)
	{
		for (var prop in this._devices)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (usn.startsWith(this._devices[prop].UDN))
			{
				this._devices[prop].prepareForRemove();
				delete this._devices[prop];
				return;
			}
		}
		Logger.log("Device " + prop + " alreadyDeleted", LogType.DEBUG);
	}

	/*getAction(udn,serviceID,actionName){
	var device = this.getDevice(udn);
	if (device == null) return;
	var service = device.getDirectService(serviceID);
	if (device == null) return;
	return service.getActionByName(actionName);
	}*/

	getService(udn, serviceID)
	{
		var device = this.getDevice(udn);
		if (device == null)
			return;
		return device.getDirectService(serviceID);
	}

	getServiceBySID(subscriptionID)
	{
		for (var prop in this._devices)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			var service = this._devices[prop].getServiceOrSubServiceBySubscriptionID(subscriptionID);
			if (service)
				return service;
		}
		Logger.log("Unable to find the service with SID " + subscriptionID, LogType.WARNING);
	}

	getDevice(udn)
	{
		for (var prop in this._devices)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			var device = this._devices[prop].getDeviceOrSubDevice(udn);
			if (device)
				return device;
		}
		Logger.log("Unable to find the device " + udn, LogType.ERROR);
	}
}

exports.ControlPoint = ControlPoint;
