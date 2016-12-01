
/* This file is part of Jeedom.
*
* Jeedom is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* Jeedom is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with Jeedom. If not, see <http://www.gnu.org/licenses/>.
*/

$("#table_cmd").sortable({
  axis: "y",
  cursor: "move",
  items: ".cmd",
  placeholder: "ui-state-highlight",
  tolerance: "intersect",
  forcePlaceholderSize: true
});
/*
* Fonction pour l'ajout de commande, appellé automatiquement par plugin.template
*/

$('body').on('upnp::includeDevice', function (_event,_options) {
    if (modifyWithoutSave) {
        $('#div_inclusionAlert').showAlert({message: '{{Un périphérique vient d\'être inclu. Veuillez réactualiser la page}}', level: 'warning'});
    } else {
        window.location.reload();
    }
});

function printEqLogic(_eqLogic) {
  $('#eqLogicAdditionalData').empty();

  if (_eqLogic.configuration.serviceId.indexOf(':AVTransport') > -1) $('.displayOptions').show();
  else if (_eqLogic.configuration.serviceId.indexOf(':ContentDirectory') > -1) $('.displayOptions').show();
  else $('.displayOptions').hide();

  if (isset(_eqLogic.configuration)) {
    if (isset(_eqLogic.configuration.additionalData)) {
      for (var i in _eqLogic.configuration.additionalData) {
        addAdditionalData(i,_eqLogic.configuration.additionalData[i],$('#eqLogicAdditionalData'))
      }
    }
  }
}

function addAdditionalData(_name,_value,_el){
  if (!isset(_name)) {
      _name = '';
  }
  if (!isset(_value)) {
      _value = '';
  }
  var txtValue;
  if(_value instanceof Array || _value instanceof Object) txtValue = JSON.stringify(_value);
  else txtValue = _value;

  var div = '<div class="form-group additionalData">';
  div += '<label class="col-sm-3 control-label">' + _name + '</label>';
  div += '<div class="col-sm-3">';

  div += '<span class="label label-default" title="' + _name + '" style="font-size : 1em;cursor : default;">' + txtValue + '</span>';
  div += '</div>';
  div += '</div>';
  if (isset(_el)) {
      _el.append(div);
      //_el.find('.mode:last').setValues(_mode, '.expressionAttr');
  }
}


function addCmdToTable(_cmd) {
  if (!isset(_cmd)) {
    var _cmd = {
      configuration: {}
    };
  }
  if (!isset(_cmd.configuration)) {
    _cmd.configuration = {};
  }
  var tr = '<tr class="cmd" data-cmd_id="' + init(_cmd.id) + '">';
  tr += '<td style="width : 200px;">';
  tr += '<span class="cmdAttr" data-l1key="id" style="display:none;"></span>';
  tr += '<input class="cmdAttr form-control input-sm" data-l1key="name" placeholder="{{Nom}}">';
  tr += '</td>';

  tr += '<td>';
  tr += '<div class="col-sm-3">';
  tr += '<span class="cmdAttr" data-l1key="configuration" data-l2key="source"></span>';
  tr += '</div>';
  tr += '</td>';

  //Type
  tr += '<td>';
  tr += '<div class="col-sm-3">';
  tr += '<span>'.init(_cmd.type).'</span>';
  tr += '</div>';
  tr += '</td>';

  //NomUpnp
  tr += '<td>';
  tr += '<div class="col-sm-3">';
  tr += '<spanclass="cmdAttr form-control input-sm" data-l1key="logicalId"></span>';
  tr += '</div>';
  tr += '</td>';

  tr += '<td>';
  //Option
  tr += '<form class="form-horizontal">';
  for (var arg in _cmd.configuration.arguments)
  {
    tr += '<div class="form-group">';
    tr += '<label class="col-sm-4 control-label">'+_cmd.configuration.arguments[arg].name+'</label>';
    tr += '<div class="col-sm-4">';
    if (init(_cmd.configuration.arguments[arg].allowedValue) && _cmd.configuration.arguments[arg].allowedValue.length > 0)
    {
      //tr += '<select class="form-control cmdAttr" data-l1key="configuration" data-l2key="ArgVal_'+_cmd.configuration.arguments[arg].name+'">';
      tr += '<select class="form-control">';
      for (var allowed in _cmd.configuration.arguments[arg].allowedValue)
      {
        tr += '<option value="' + _cmd.configuration.arguments[arg].allowedValue[allowed] + '">' + _cmd.configuration.arguments[arg].allowedValue[allowed] + '</option>';
      }
      tr += '</select>';
    }
    else
    {
      if (_cmd.configuration.arguments[arg].type == 'ui1' || _cmd.configuration.arguments[arg].type == 'ui2' || _cmd.configuration.arguments[arg].type == 'ui4')
      {
        tr += '<input class="form-control" type="number" placeholder="{{Value}}" />';
        //tr += '<input class="form-control input-sm cmdAttr" data-l1key="configuration" data-l2key="ArgVal_'+_cmd.configuration.arguments[arg].name+'" type="number" placeholder="{{Value}}" />';
      }
      else
      {
        tr += '<input class="form-control" type="text" placeholder="{{Value}}" />';
        //tr += '<input class="form-control input-sm cmdAttr" data-l1key="configuration" data-l2key="ArgVal_'+_cmd.configuration.arguments[arg].name+'" type="text" placeholder="{{Value}}" />';
      }
    }
    tr += '</div>';
    tr += '</div>';
  }
  tr += '</form>';
  tr += '</td>';

  tr += '<td>';
  //tr += '<span><input type="checkbox" class="cmdAttr bootstrapSwitch" data-size="mini" data-l1key="isVisible" data-label-text="{{Afficher}}" checked/></span> ';
  tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="isVisible" checked/>{{Afficher}}</label>';
  if (init(_cmd.type) == 'info' && (init(_cmd.subType) == 'numeric' || init(_cmd.subType) == 'binary')) {
    //tr += '<span><input type="checkbox" class="cmdAttr bootstrapSwitch" data-size="mini" data-l1key="isHistorized" data-label-text="{{Historiser}}" /></span> ';
    tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="isHistorized" checked/>{{Historiser}}</label>';
  }
  tr += '</td>';

  tr += '<td>';
  if (is_numeric(_cmd.id)) {
    tr += '<a class="btn btn-default btn-xs cmdAction expertModeVisible" data-action="configure"><i class="fa fa-cogs"></i></a> ';
    tr += '<a class="btn btn-default btn-xs cmdAction" data-action="test"><i class="fa fa-rss"></i> {{Tester}}</a>';
  }
  //tr += '<i class="fa fa-minus-circle pull-right cmdAction cursor" data-action="remove"></i>';
  tr += '</td>';
  tr += '</tr>';
  $('#table_cmd tbody').append(tr);
  $('#table_cmd tbody tr:last').setValues(_cmd, '.cmdAttr');
  if (isset(_cmd.type)) {
    $('#table_cmd tbody tr:last .cmdAttr[data-l1key=type]').value(init(_cmd.type));
  }
  jeedom.cmd.changeType($('#table_cmd tbody tr:last'), init(_cmd.subType));
}
