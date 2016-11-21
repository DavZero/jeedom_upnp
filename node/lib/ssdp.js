"use strict";

var dgram   = require("dgram");

var httpHeader = /HTTP\/\d{1}\.\d{1} \d+ .*/
  , ssdpHeader = /^([^:]+):\s*(.*)$/;

// SSDP
//const PORT = 1900;
const BROADCAST_ADDR = "239.255.255.250";
const ALIVE = 'ssdp:alive';
const BYEBYE = 'ssdp:byebye';
const UPDATE = 'ssdp:update';
const ALL = 'ssdp:all';

// Map SSDP/UPNP notification sub type to emitted events
const NTS_EVENTS = {
  'ssdp:alive': 'DeviceAvailable',
  'ssdp:byebye': 'DeviceUnavailable',
  'ssdp:update': 'DeviceUpdate',
  //'upnp:propchange' : 'PropertyChange'
};

var debug;
if (process.env.NODE_DEBUG && /upnp/.test(process.env.NODE_DEBUG)) {
  debug = function(x) { console.error('SSDP: %s', x); };

} else {
  debug = function() { };
}

class SSDPMessage
{
  /*Message Header
  "CACHE-CONTROL": "max-age=1900",
  "DATE": "Wed, 06 Apr 2016 18:23:25 GMT",
  "EXT": "",
  "LOCATION": "http://192.168.0.5:50001/desc/device.xml",
  "OPT": "\"http://schemas.upnp.org/upnp/1/0/\"; ns=01",
  "01-NLS": "15845e42-1dd2-11b2-8dcc-8920a3196d0d",
  "SERVER": "Linux/3.2.40, UPnP/1.0, Portable SDK for UPnP devices/1.6.18",
  "X-USER-AGENT": "redsonic",
  "ST": "urn:microsoft.com:service:X_MS_MediaReceiverRegistrar:1",
  "USN": "uuid:000c29cc-72e2-000c-e272-e272cc290c00::urn:microsoft.com:service:X_MS_MediaReceiverRegistrar:1"
  */

  /*rinfo
  "address": "192.168.0.5",
  "family": "IPv4",
  "port": 42359,
  "size": 498
  */
  constructor(message)
  {
    this._message = message.toString('ascii');
    debug(this._message);
  }

  original()
  {
    return this._message;
  }

  getHeaders()
  {
    var lines = this._message.split("\r\n");
    var headers = {};
    lines.forEach(function (line) {
      if (line.length) {
        var pairs = line.match(ssdpHeader);
        if (pairs) headers[pairs[1].toUpperCase()] = pairs[2]; // e.g. {'HOST': 239.255.255.250:1900}
      }
    });
    return headers;
  }

  getMethod()
  {
    var lines = this._message.split('\r\n')
      , type = lines.shift().split(' ')// command, such as "NOTIFY * HTTP/1.1"
      , method = type[0];
    return method;
  }

  getBody()
  {
    return '';
  }
}

class SSDP //extends EventEmmitter
{
  constructor(ssdpPort)
  {
    this._ssdpPort=ssdpPort
  }

  startServer(callback)
  {
    this._server = dgram.createSocket({type:'udp4' ,reuseAddr:true});
    //this._server = dgram.createSocket('udp4');
    this._server.on('message', function(msg, rinfo) {
      callback(new SSDPMessage(msg), rinfo);
    });

    this._server.bind(this._ssdpPort, () => {
      this._server.addMembership(BROADCAST_ADDR);
    });
  }

  stopServer()
  {
    this._server.close();
  }

  sendMSearch(st,callback)
  {
    if (typeof st !== 'string') {
      st = ALL;
    }

    var message =
      "M-SEARCH * HTTP/1.1\r\n"+
      "Host:"+BROADCAST_ADDR+":"+this._ssdpPort+"\r\n"+
      "ST:"+st+"\r\n"+
      "Man:\"ssdp:discover\"\r\n"+
      "MX:3\r\n\r\n",
      client = dgram.createSocket({type:'udp4' ,reuseAddr:true}),
      //client = dgram.createSocket('udp4'),
      server = dgram.createSocket({type:'udp4' ,reuseAddr:true});

    server.on('message', function(msg, rinfo) {
      callback(new SSDPMessage(msg), rinfo);
    });

    server.on('listening', () => {
      client.send(new Buffer(message, "ascii"), 0, message.length, this._ssdpPort, BROADCAST_ADDR, function () {
        client.close();
      });
    });

    client.on('listening', function () {
      server.bind(client.address().port);
    });

    client.bind();

    // MX is set to 3, wait for 1 additional sec. before closing the server
    setTimeout(function(){
      server.close();
    }, 4000);
  }
}

exports.SSDP = SSDP;
exports.SSDPMessage = SSDPMessage;
exports.NTS_EVENTS = NTS_EVENTS;
