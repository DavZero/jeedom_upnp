var controlPointAPI = require('./lib/upnp_controlPoint');
var url = require('url');
var LogType = require('./logger/logger.js').logType;
var Logger = require('./logger/logger.js').getInstance();
var request = require('request');
var net = require('net');

Logger.setLogLevel(LogType.DEBUG);

/******* Utility *****************/
var urlJeedom = '';
var logLevel = 'error';
var serverPort = 5001;
var actionTimeout = 5;

// print process.argv
process.argv.forEach(function (val, index, array)
{
	switch (index)
	{
	case 2:
		urlJeedom = val;
		break;
	case 3:
		serverPort = val;
		break;
	case 4:
		logLevel = val;
		if (logLevel == 'debug')
			Logger.setLogLevel(LogType.DEBUG);
		else if (logLevel == 'info')
			Logger.setLogLevel(LogType.INFO);
		else if (logLevel == 'warning')
			Logger.setLogLevel(LogType.WARNING);
		else
			Logger.setLogLevel(LogType.ERROR);
		break;

	case 5:
		actionTimeout = val;
		break;
	}
}
);

Logger.log("Démon version 1.0.1", LogType.INFO);
Logger.log("urlJeedom = " + urlJeedom, LogType.DEBUG);
Logger.log("serverPort = " + serverPort, LogType.DEBUG);
Logger.log("logLevel = " + logLevel, LogType.INFO);
Logger.log("timeout = " + actionTimeout, LogType.INFO);

var busy = false;
var jeedomSendQueue = [];

var processJeedomSendQueue = function ()
{
	//Logger.log('Nombre de messages en attente de traitement : ' + jeedomSendQueue.length, LogType.DEBUG);
	var nextMessage = jeedomSendQueue.shift();

	if (!nextMessage)
	{
		busy = false;
		return;
	}
	Logger.log('Traitement du message : ' + JSON.stringify(nextMessage), LogType.DEBUG);
	request(
	{
		uri: nextMessage.url,
		qs:
		{
			type: nextMessage.type
		},
		method: nextMessage.method,
		json: nextMessage.data
	}, function (err, response, body)
	{
		if (err)
		{
			Logger.log(err, LogType.WARNING);
			if (nextMessage.tryCount < 5)
			{
				nextMessage.tryCount++;
				jeedomSendQueue.unshift(nextMessage);
			}
			else
				Logger.log("Unable to send to jeedom: " + JSON.stringify(nextMessage) + ", errror : " + JSON.stringify(err), LogType.ERROR);
		}
		//else Logger.log("Response from Jeedom: " + response.statusCode, LogType.DEBUG);
		processJeedomSendQueue();
	}
	);
}

var sendToJeedom = function (data, callback)
{
	var message = {};
	message.url = urlJeedom;
	message.data = data;
	message.type = 'upnp';
	message.method = 'POST';
	message.tryCount = 0;
	jeedomSendQueue.push(message);
	if (busy)
		return;
	busy = true;
	processJeedomSendQueue();
}

var cp;

//Create server for manage Jeedom->upnp
var server = net.createServer((c) =>
	{
		c.on('error', (e) =>
		{
			Logger.log("Error server disconnected, err : " + e, LogType.WARNING);
			//cp.shutdown();
		}
		);

		c.on('close', () =>
		{
			Logger.log("Server disconnected", LogType.DEBUG);
			//cp.shutdown();
		}
		);

		c.on('data', (data) =>
		{
			Logger.log("Data receive from Jeedom: " + data, LogType.DEBUG);
			var timeoutFunction = setTimeout(function ()
				{
					sendToJeedom(
					{
						eventType: 'error',
						description: 'Unable to process ' + data + ' within ' + actionTimeout + ' seconds'
					}
					);
					try
					{
						c.end('Unable to process ' + data + ' within ' + actionTimeout + ' seconds');
					}
					catch (e)
					{
						//Doesn't matter if it's close the nothing else to do
					}
				}, actionTimeout * 1000);
			processJeedomMessage(data, (response) =>
			{
				clearTimeout(timeoutFunction);
				try
				{
					c.end(response);
				}
				catch (e)
				{
					//Doesn't matter if it's close the nothing else to do
				}
			}
			);
		}
		);
	}
	);

server.listen(
{
	host: 'localhost',
	port: serverPort
}, (e) =>
{
	Logger.log("Création du serveur sur le port " + serverPort, LogType.INFO);
	Logger.log("Création du controlPoint");
	cp = new controlPointAPI.ControlPoint(1900);
	cp.search();
	//cp.search('upnp:rootdevice');
	cp.on('upnpError', function (err)
	{
		sendToJeedom(
		{
			eventType: 'error',
			description: err
		}
		);
	}
	);

	cp.on('actionDiscovered', function (action)
	{
		var data =
		{
			eventType: 'createAction',
			deviceUDN: action.Service.Device.UDN,
			serviceId: action.Service.ID,
			name: action.Name,
			fromDevice: action.IsFromDevice,
			arguments: []
		};
		action.Arguments.forEach((item) =>
		{
			if (item.Direction == 'in')
			{
				var argument =
				{
					name: item.Name,
					type: item.RelatedStateVariable.Type
				};

				if (item.RelatedStateVariable.AllowedValue)
				{
					argument.allowedValue = item.RelatedStateVariable.AllowedValue;
				}

				data.arguments.push(argument);
			}
		}
		);
		sendToJeedom(data);
	}
	);

	cp.on('variableDiscovered', function (variable)
	{
		var data =
		{
			eventType: 'createInfo',
			deviceUDN: variable.Service.Device.UDN,
			serviceId: variable.Service.ID,
			name: variable.Name,
			fromDevice: variable.IsFromDevice,
			type: variable.Type
		};

		sendToJeedom(data);
	}
	);

	cp.on('variableUpdated', function (variable, newVal)
	{
		var data =
		{
			eventType: 'updateInfo',
			deviceUDN: variable.Service.Device.UDN,
			serviceId: variable.Service.ID,
			name: variable.Name,
			fromDevice: variable.IsFromDevice,
			type: variable.Type,
			value: newVal
		};

		sendToJeedom(data);
	}
	);

	cp.on('serviceUpdated', function (service)
	{
		var data =
		{
			eventType: 'updateService',
			deviceUDN: service.Device.UDN,
			serviceId: service.ID,
			friendlyName: service.Device.Name,
			location: service.Device.BaseAddress,
			icon: service.Device.IconUrl,
			description: service.Device.Location.href,
      serviceDescription: service.DescriptionURL,
			additionalData: service.Device.AdditionalInformation,
			isOnline: true
		};

		sendToJeedom(data);
	}
	);

	cp.on('serviceOffline', function (service)
	{
		var data =
		{
			eventType: 'updateService',
			deviceUDN: service.Device.UDN,
			serviceId: service.ID,
			isOnline: false
		};

		sendToJeedom(data);
	}
	);
}
);

var processJeedomMessage = function (payload, callback)
{
	var data = JSON.parse(payload);
	if (data.command == 'executeAction')
	{
		Logger.log("Execution de l'action " + JSON.stringify(data));
		var service = cp.getService(data.UDN, data.serviceID);
		if (service == null)
		{
			Logger.log("Impossible de trouver le service " + data.UDN + "::" + data.serviceID + " sur le reseau", LogType.ERROR);
			var message =
			{
				eventType: 'error',
				description: "Impossible de trouver le service " + data.UDN + "::" + data.serviceID + " sur le reseau"
			};
			sendToJeedom(message);
			if (callback)
				callback();
		}
		else
		{
			service.executeAction(data.actionName, data.options, (err, response) =>
			{
				Logger.log("Envoi de la réponse " + response, LogType.DEBUG);
				if (callback)
					callback(response);

				if (err)
				{
					var message =
					{
						eventType: 'error',
						description: err
					};
					sendToJeedom(message);
				}

				if (response)
				{
					var message =
					{
						eventType: 'updateInfo',
						deviceUDN: data.UDN,
						serviceId: data.serviceID,
						name: 'LastResponse',
						type: 'string',
						value: response
					}
					sendToJeedom(message);
				}
			}
			);
		}
	}
	else if (data.command == 'getServiceInfo')
	{
		Logger.log("Mise a jour du service " + JSON.stringify(data));
		var service = cp.getService(data.UDN, data.serviceId);
		if (service != null)
		{
			service.updateInfo();
			if (callback)
				callback();
			return;
		}
		Logger.log("Impossible de trouver le service " + data.UDN + "::" + data.serviceID + " sur le reseau", LogType.ERROR);
		var message =
		{
			eventType: 'error',
			description: "Impossible de trouver le service " + data.UDN + "::" + data.serviceID + " sur le reseau"
		};
		sendToJeedom(message);
		if (callback)
			callback();
	}
	else if (data.command == 'stopDaemon')
	{
		Logger.log("Arret du service " + JSON.stringify(data));
		server.close();
		cp.shutdown();
		if (callback)
			callback();
	}
	else
	{
		var message =
		{
			eventType: 'error',
			description: "Commande inconnu " + JSON.stringify(data)
		};
		sendToJeedom(message);
		if (callback)
			callback();
	}
}

/*
setTimeout(function(){
var data = {
command:'executeAction',
UDN:'uuid:2a48ccfe-1dd2-11b2-a765-f435d154ade3',
serviceID:'urn:upnp-org:serviceId:RenderingControl',
actionName:'SetVolume',
options:{
InstanceID:0,
Channel:'Master',
DesiredVolume:14
}
};
processJeedomMessage(JSON.stringify(data));
}, 10000);
 */

process.on('uncaughtException', function (err)
{
	console.error('An uncaughtException was found, the program will end : ' + err);
	Logger.log('An uncaughtException was found, the program will end : ' + err, LogType.ERROR);
	throw err;
}
);
