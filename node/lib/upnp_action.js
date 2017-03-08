"use strict";

var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var SOAPBuilder = require('./SOAPBuilder.js').SOAPBuilder;
//var XmlEntities = require('html-entities').XmlEntities;
var xml2js = require('xml2js');
var stripNS = require('xml2js').processors.stripPrefix;

class UpnpAction
{
	constructor(service, actionData, fromDevice)
	{
		Logger.log("Création de l'action : " + JSON.stringify(actionData), LogType.DEBUG);
		this._service = service;
		this._fromDevice = fromDevice;
		this._initialize(actionData);
	}

	_initialize(actionData, callback)
	{
		this._name = actionData.name[0];
		this._arguments = [];
		if (actionData.argumentList && actionData.argumentList[0].argument)
		{
			actionData.argumentList[0].argument.forEach((item) => {
        if (!item.name) Logger.log("Unable to create argument without name for action : " + JSON.stringify(actionData), LogType.WARNING);
				else if (!item.direction) Logger.log("Unable to create argument without direction for action : " + JSON.stringify(actionData), LogType.WARNING);
        else this._arguments.push(new UpnpActionArgument(item, this._service));
			});
		}
	}

	get IsFromDevice()
	{
		return this._fromDevice;
	}

	execute(options, callback)
	{
		var quey = new SOAPBuilder(this, options);
		quey.sendMessage((err, responseBody) =>
		{
			if (err)
			{
				Logger.log("Error executiong action : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify(options) + ", err : " + err, LogType.ERROR);
				//this._service.Device.emit('error',"Error executiong action : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify (options) + ", err : " + err);
				callback("Error executiong action : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify(options) + ", err : " + err, null);
			}
			else
			{
				//Process Response
				Logger.log("Successfully execute action : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify(options), LogType.DEBUG);
				//On decode le XML au cas ou pour qu'il soit également convertie en JSON
				//responseBody = XmlEntities.decode(responseBody);
				//On convertie en js Object en supprimant les namespaces pour traitement du json en php
				xml2js.parseString(responseBody, { tagNameProcessors: [stripNS] }, (err, data) =>
				{
					//Manage error
					var returnData = '';
					if (err)
					{
						//this._service.Device.emit('error',"Error parsing response XML for action : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify (options) + ", err : " + err + ", XML : " + responseBody);
						callback("Error parsing response XML for action : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify(options) + ", err : " + err + ", XML : " + responseBody, null);
					}
					else
					{
						//if (!data || !data['s:Envelope'] || !data['s:Envelope']['s:Body']) namespace change depending of manufacturer
              if (!data || !data['Envelope'] || !data['Envelope']['Body'])
            {
              Logger.log("Unable to process action " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + " response : " + JSON.stringify(data), LogType.ERROR);
              //Should return an error instead of just return.
              return;
            }
            //returnData = data['s:Envelope']['s:Body'][0]; namespace change depending of manufacturer
            returnData = data['Envelope']['Body'][0]; 
						//if (returnData['s:Fault']) namespace change depending of manufacturer
            if (returnData['Fault'])
							//returnData = data['Envelope']['Body'][0];
							//if (returnData['Fault'])
						{
							//Gestion de l'Erreur
							//this._service.Device.emit('error',"Upnp action error for : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify (options) + ", err : " + JSON.stringify(returnData));
							if (callback)
								callback("Upnp action error for : " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify(options) + ", err : " + JSON.stringify(returnData), JSON.stringify(returnData));
							return;
						}
					}
					if (callback)
						callback(null, JSON.stringify(returnData));
					//Todo Process response and update data if nacessary
					//var outputsVariable = returnData['u:' + this.Name + 'Response'][0]; namespace change depending of manufacturer
          var outputsVariable = returnData[this.Name + 'Response'][0];
					for (var prop in outputsVariable)
					{
						if (prop == '$')
							continue;
						Logger.log("Processing update action's output argument " + JSON.stringify(prop) + " with val " + JSON.stringify(outputsVariable[prop][0]), LogType.DEBUG);
						var arg = this.getArgumentByName(prop);
						if (arg && arg.RelatedStateVariable)
						{
							arg.RelatedStateVariable.Value = outputsVariable[prop][0];
						}
						else
							Logger.log("Unable to process output argument " + prop + " of action " + this.Service.Device.UDN + '/' + this.Service.ID + '/' + this._name + ' with options : ' + JSON.stringify(options), LogType.WARNING);
					}
				});
			}
		});
	}

	get Service()
	{
		return this._service;
	}

	get Name()
	{
		return this._name;
	}

	get Arguments()
	{
		return this._arguments
	}

	getArgumentByName(name)
	{
		for (var prop in this._arguments)
		{
			//console.log("obj." + prop + " = " + this._devices[prop] + "/" + this._devices[prop].UDN);
			if (name == this._arguments[prop].Name)
			{
				return this._arguments[prop];
			}
		}
		Logger.log("Unable to find the action's argument with name " + name, LogType.DEBUG);
		return null;
	}

	ToString()
	{
		var argString = "";
		this._arguments.forEach((item) =>
		{
			argString += item.ToString() + "\n";
		}
		);
		return "Action Name : " + this._name + " => \n" + argString;
	}
}

class UpnpActionArgument
{
	/*
	<argument>
	<name>InstanceID</name>
	<direction>in</direction>
	<relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable>
	</argument>
	<argument>
	<name>CurrentURI</name>
	<direction>in</direction>
	<relatedStateVariable>AVTransportURI</relatedStateVariable>
	</argument>
	 */
	constructor(variable, service)
	{
		Logger.log("Création de l'argument : " + JSON.stringify(variable), LogType.DEBUG);
		this._name = variable.name[0];
		this._direction = variable.direction[0];
		this._relatedStateVariable = service.getVariableByName(variable.relatedStateVariable[0]);
    if (!this._relatedStateVariable) Logger.log("Unable to map argument : " + variable.name[0] + " with corresponding variable of service " + service.ID, LogType.WARNING);
	}

	get Name()
	{
		return this._name;
	}

	get Direction()
	{
		return this._direction;
	}

	get RelatedStateVariable()
	{
		return this._relatedStateVariable;
	}

	ToString()
	{
		return "Argument Name : " + this._name + ",  Argument Direction : " + this._direction + ",  Argument relatedVariable : " + this._relatedVariable.Name();
	}
}

exports.UpnpAction = UpnpAction;
