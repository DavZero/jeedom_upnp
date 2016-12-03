"use strict";

var LogType = require('../logger/logger.js').logType;
var Logger = require('../logger/logger.js').getInstance();
var EventEmitter = require('events');

class UpnpVariable extends EventEmitter
{
	constructor(service, variableData, fromDevice)
	{
		super();
		Logger.log("Création de la variable : " + JSON.stringify(variableData), LogType.DEBUG);
		this._service = service;
		this._fromDevice = fromDevice;
		this._initialize(variableData);
	}

	_initialize(variableData, callback)
	{
		this._name = variableData.name[0];
		if (variableData.allowedValueList)
		{
			this._allowedValues = [];
			variableData.allowedValueList[0].allowedValue.forEach((item) =>
			{
				this._allowedValues.push(item);
			}
			);
		}
		this._type = variableData.dataType[0];
		this._sendEvents = variableData['$'].sendEvents == "yes" ? true : false;
	}

	get IsFromDevice()
	{
		return this._fromDevice;
	}

	get Name()
	{
		return this._name;
	}

	get Value()
	{
		return this._value;
	}

	get Service()
	{
		return this._service;
	}

	set Value(newVal)
	{
		this._value = newVal;
		this.emit('updated', this, newVal);
	}

	get Type()
	{
		return this._type;
	}

	get AllowedValue()
	{
		return this._allowedValues;
	}

	get SendEvent()
	{
		return this._sendEvents;
	}

	ToString()
	{
		return "Variable Name : " + this._name + ",  Variable type : " + this._type + ",  Variable event : " + this._sendEvents + ", Variable value : " + this._value;
	}
}

exports.UpnpVariable = UpnpVariable;
