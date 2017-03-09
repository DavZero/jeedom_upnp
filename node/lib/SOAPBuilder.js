"use strict";

var util = require('util');
var request = require('request');
var Logger = require('../logger/logger.js').getInstance();
var LogType = require('../logger/logger.js').logType;
var XmlEntities = require('html-entities').XmlEntities;

var SAOP_Header = [
	'<?xml version="1.0" encoding="utf-8"?>',
	'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
	'<s:Body>'].join('\n');
var SOAP_Footer = ['</s:Body>',
	'</s:Envelope>'
].join('\n');

class SOAPBuilder
{
	constructor(action, options)
	{
		this._action = action;
		this._options = options;
	}

_getBody()
	{
		var output = SAOP_Header;
		output += '<u:' + this._action.Name + ' xmlns:u=\"' + this._action.Service.Type + '\">\n';
		this._action.Arguments.forEach((item) => {
			if (item.Direction == 'in')
			{
				if (item.Name in this._options)
				{
					output += '<' + item.Name + '>';
          try
          {
            output += XmlEntities.encode(this._options[item.Name]);
          }
          catch (e)
          {
            Logger.log("Unable to xml encode : " + this._options[item.Name] + ", use value as is", LogType.WARNING);
            output += this._options[item.Name];
          }
					output += '</' + item.Name + '>';
				}
				else
					throw new Error('input variable ' + item.Name + ' must be defined');
			}
		});
		output += '</u:' + this._action.Name + '>';
		output += SOAP_Footer;

		return output;
	}

	sendMessage(callback)
	{
		try
		{
			var options =
			{
				method: 'POST',
				uri: this._action.Service.ControlUrl,
				headers:
				{
					'SOAPAction': '"' + this._action.Service.Type + '#' + this._action.Name + '"',
					'Content-Type': 'text/xml; charset="utf-8"'
				},
				body: this._getBody()
			};

			request.post(options, function (err, response, body){
				if (err)
        {
          console.log('err : ' + err);
        }
				if (callback)
					callback(err, body);
			});
		}
		catch (e)
		{
      if (callback)
				callback(e, null);
		}
	}
}

exports.SOAPBuilder = SOAPBuilder;
