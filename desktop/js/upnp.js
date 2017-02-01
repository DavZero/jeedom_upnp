
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

$('#bt_healthUpnp').on('click', function () {
    $('#md_modal').dialog({title: "{{Santé Upnp}}"});
    $('#md_modal').load('index.php?v=d&plugin=upnp&modal=health').dialog('open');
});

$('#bt_scanEqLogic').on('click', function () {
  $.ajax({// fonction permettant de faire de l'ajax
      type: "POST", // méthode de transmission des données au fichier php
      url: "plugins/upnp/core/ajax/upnp.ajax.php", // url du fichier php
      data: {
          action: "scanUpnp"
      },
      dataType: 'json',
      error: function (request, status, error) {
          handleAjaxError(request, status, error);
      },
      success: function (data) { // si l'appel a bien fonctionné
          if (data.state != 'ok') {
              $('#div_alert').showAlert({message: data.result, level: 'danger'});
              return;
          }
          else $('#div_alert').showAlert({message: data.result, level: 'warning'});
          //window.location.reload();
      }
  });
});

$('.changeIncludeState').on('click', function () {
	var newState = $(this).attr('data-state');
	jeedom.config.save({
		plugin: 'upnp',
		configuration:{	eqLogicIncludeState: newState },
		error: function (error)
		{
			$('#div_alert').showAlert({
				message: error.message,
				level: 'danger'
			});
		},
		success: function ()
		{
			if (newState == 1)
			{
				$.hideAlert();
				$('.changeIncludeState:not(.card)').removeClass('btn-default').addClass('btn-success');
				$('.changeIncludeState').attr('data-state', 0);
				$('.changeIncludeState.card').css('background-color', '#8000FF');
				$('.changeIncludeState.card span center').text('{{Arrêter l\'inclusion}}');
				$('.changeIncludeState:not(.card)').html('<i class="fa fa-sign-in fa-rotate-90"></i> {{Arreter inclusion}}');
				$('#div_alert').showAlert({
          message: '{{Vous etes en mode inclusion. Recliquez sur le bouton d\'inclusion pour sortir de ce mode}}',
					level: 'warning'
				});
			}
			else
			{
				$.hideAlert();
				$('.changeIncludeState:not(.card)').addClass('btn-default').removeClass('btn-success btn-danger');
				$('.changeIncludeState').attr('data-state', 1);
				$('.changeIncludeState:not(.card)').html('<i class="fa fa-sign-in fa-rotate-90"></i> {{Mode inclusion}}');
				$('.changeIncludeState.card span center').text('{{Mode inclusion}}');
				$('.changeIncludeState.card').css('background-color', '#ffffff');
			} 
      $.ajax({// fonction permettant de faire de l'ajax
        type: "POST", // methode de transmission des données au fichier php
        url: "plugins/upnp/core/ajax/upnp.ajax.php", // url du fichier php
        data: {
          action: "changeIncludeState",
          state: newState
        },
        dataType: 'json',
        error: function(request, status, error) {
          handleAjaxError(request, status, error);
        },
        success: function(data) { // si l'appel a bien fonctionné
          if (data.state != 'ok') {
            $('#div_alert').showAlert({message:  data.result,level: 'danger'});
          }
        }
      });
    }
  });
});
  

$("#table_cmd").sortable({
  axis: "y",
  cursor: "move",
  items: ".cmd",
  placeholder: "ui-state-highlight",
  tolerance: "intersect",
  forcePlaceholderSize: true
});

$('.cmdAction[data-action=addUserCmd]').off('click').on('click', function () {
    addUserCmdToTable();
    initCheckBox();
    $('.cmd:last .cmdAttr[data-l1key=type]').trigger('change');
});

$('#bt_removeAll').on('click', function () {
  $.ajax({
    url: "plugins/upnp/core/ajax/upnp.ajax.php",
    data: {"action": "removeAll"},
    dataType: "json",
    success: function (data) {
      if (data.state != 'ok') {
        $('#div_alert').showAlert({message: data.result, level: 'danger'});
      }
      else if (modifyWithoutSave) {
        $('#div_inclusionAlert').showAlert({message: '{{Un périphérique vient d\'être inclu. Veuillez réactualiser la page}}', level: 'warning'});
      } else {
          window.location.reload();
      }
    },
    error: function (request, status, error) {
      handleAjaxError(request, status, error);
    }
  });
});

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

function addUserCmdToTable()
{
  var cmd = {
    type: 'action',
    subType: 'other',
    logicalId: 'UpnpUserAction'
  };
  
  addCmdToTable(cmd);
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
  tr += '<a class="cmdAction btn btn-default btn-sm" data-l1key="chooseIcon"><i class="fa fa-flag"></i> {{Icône}}</a>';
  tr += '<span class="cmdAttr" data-l1key="id" style="display:none;"></span>';
  tr += '<span class="cmdAttr" data-l1key="type" style="display:none;"></span>';
  tr += '<span class="cmdAttr" data-l1key="subType" style="display:none;"></span>';
  tr += '<input class="cmdAttr form-control input-sm" data-l1key="name" placeholder="{{Nom}}">';
  tr += '</td>';

  /*tr += '<td>';
  tr += '<div class="col-sm-3">';
  tr += '<span class="cmdAttr" data-l1key="configuration" data-l2key="source"></span>';
  tr += '</div>';
  tr += '</td>';*/

  //Type
  tr += '<td>';
  tr += '<div class="col-sm-3">';
  if (init(_cmd.logicalId) == 'UpnpUserAction') tr += '<span class="cmdAttr" data-l1key="logicalId"></span>';
  else tr += '<span>' + init(_cmd.type) + '</span>';
  tr += '</div>';
  tr += '</td>';

  //NomUpnp
  tr += '<td>';
  if (init(_cmd.logicalId) == 'UpnpUserAction')
  {
    tr += '<form class="form-horizontal">';
    tr += '<div class="form-group">';
    tr += '<label class="col-sm-2 control-label">Action</label>';
    tr += '<div class="col-sm-6" >';
    tr += '<select class="cmdAttr form-control input-sm" data-l1key="configuration" data-l2key="upnpAction" style="margin-top : 5px;" title="Commande Upnp source">';
    tr += '<option value="">Aucune</option>';
    tr += '</select>';
    tr += '</div>';
    tr += '</div>';
    
    tr += '<div class="form-group">';
    tr += '<label class="col-sm-2 control-label">Info</label>';
    tr += '<div class="col-sm-6" >';
    tr += '<select class="cmdAttr form-control input-sm" data-l1key="value" style="margin-top : 5px;" title="Information associée">';
    tr += '<option value="">Aucune</option>';
    tr += '</select>';
    tr += '</div>';
    tr += '</div>';
    tr += '</form>';
  }
  else
  {
    tr += '<span class="cmdAttr" data-l1key="logicalId"></span>';
  }
  tr += '</div>';
  tr += '</td>';
  
  //Option
  tr += '<td>';
  tr += '<form class="form-horizontal options">';
  //Les options sont mises a jour dynamiquement
  tr += '</form>';
  tr += '</td>';
  
  tr += '<td>';
  //tr += '<span><input type="checkbox" class="cmdAttr bootstrapSwitch" data-size="mini" data-l1key="isVisible" data-label-text="{{Afficher}}" checked/></span> ';
  tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="isVisible" checked/>{{Afficher}}</label>';
  
  if (init(_cmd.type) == 'info' && (init(_cmd.subType) == 'numeric' || init(_cmd.subType) == 'binary')) {
    //tr += '<span><input type="checkbox" class="cmdAttr bootstrapSwitch" data-size="mini" data-l1key="isHistorized" data-label-text="{{Historiser}}" /></span> ';
    tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="isHistorized" checked/>{{Historiser}}</label>';
  }
  else if (init(_cmd.type) == 'action') tr += '<label class="checkbox-inline"><input type="checkbox" class="cmdAttr" data-l1key="configuration" data-l2key="isOptionsVisible" checked/>{{Afficher options}}</label>';
  tr += '</td>';

  tr += '<td>';
  if (is_numeric(_cmd.id)) {
    tr += '<a class="btn btn-default btn-xs cmdAction expertModeVisible" data-action="configure"><i class="fa fa-cogs"></i></a> ';
    tr += '<a class="btn btn-default btn-xs cmdAction" data-action="test"><i class="fa fa-rss"></i> {{Tester}}</a>';
  }
  if (init(_cmd.logicalId) == 'UpnpUserAction')
    tr += '<i class="fa fa-minus-circle pull-right cmdAction cursor" data-action="remove"></i>';
  tr += '</td>';
  tr += '</tr>';
  $('#table_cmd tbody').append(tr);  
  
  $('#table_cmd tbody tr:last').setValues(_cmd, '.cmdAttr');

  var tr = $('#table_cmd tbody tr:last');
  
  if (init(_cmd.logicalId) == 'UpnpUserAction')
  {
    jeedom.cmd.byId({
      id:_cmd.configuration.upnpAction, 
      success: function (upnpCmd){
        updateOptions(tr,_cmd,upnpCmd.configuration.arguments);
      }
    });
  }
  else if (init(_cmd.type) == 'action') updateOptions(tr,_cmd,_cmd.configuration.arguments);
  
  buildUPnPActionSelectCmd({
    id: $(".li_eqLogic.active").attr('data-eqLogic_id'),
    error: function (error) {
      $('#div_alert').showAlert({message: error.message, level: 'danger'});
    },
    success: function (result) {
      tr.find('.cmdAttr[data-l2key=upnpAction]').append(result);
      tr.setValues(_cmd, '.cmdAttr');
    }
  });
  
  jeedom.eqLogic.builSelectCmd({
    id: $(".li_eqLogic.active").attr('data-eqLogic_id'),
    filter: {type: 'info'},
    error: function (error) {
      $('#div_alert').showAlert({message: error.message, level: 'danger'});
    },
    success: function (result) {
      tr.find('.cmdAttr[data-l1key=value]').append(result);
      tr.setValues(_cmd, '.cmdAttr');
    }
  });  
}

function updateOptions(tr,cmd,args)
{
  var options = "";
  tr.find('.options').empty()
  
  if (!isset(args)) args = [];
  var lastParameter = {
    name : 'WaitResponse',
    type: 'Boolean'
  };
  if (args.length == 0 || args[args.length - 1].name != 'WaitResponse')
    args.push(lastParameter);
  
  for (var arg in args)
  {
    options += '<div class="form-group">';
    options += '<label class="col-sm-4 control-label">'+args[arg].name+'</label>';
    options += '<div class="col-sm-4">';
    if (init(args[arg].allowedValue) && args[arg].allowedValue.length > 0)
    {
      options += '<select class="form-control cmdAttr" data-l1key="configuration" data-l2key="ArgVal_'+args[arg].name+'">';
      //options += '<select class="form-control">';
      for (var allowed in args[arg].allowedValue)
      {
        options += '<option value="' + args[arg].allowedValue[allowed] + '">' + args[arg].allowedValue[allowed] + '</option>';
      }
      options += '</select>';
    }
    else
    {
      if (args[arg].type == 'ui1' || args[arg].type == 'ui2' || args[arg].type == 'ui4')
      {
        //options += '<input class="form-control" type="number" placeholder="{{Value}}" />';
        options += '<input class="form-control input-sm cmdAttr" data-l1key="configuration" data-l2key="ArgVal_'+args[arg].name+'" type="number" placeholder="{{Value}}" />';
      }
      else
      {
        //options += '<input class="form-control" type="text" placeholder="{{Value}}" />';
        options += '<input class="form-control input-sm cmdAttr" data-l1key="configuration" data-l2key="ArgVal_'+args[arg].name+'" type="text" placeholder="{{Value}}" />';
      }
    }
    options += '</div>';
    options += '</div>'; 
  } 
  tr.find('.options').append(options);
  tr.setValues(cmd, '.cmdAttr');
}

function buildUPnPActionSelectCmd(_params) {
  jeedom.eqLogic.getCmd({
    id: _params.id,
    async: false,
    success: function (cmds) {
      var result = '';
      for (var i in cmds) {
        if (cmds[i].type == 'action' && cmds[i].logicalId != 'UpnpUserAction') {
          result += '<option value="' + cmds[i].id + '" data-type="' + cmds[i].type + '"  data-subType="' + cmds[i].subType + '" >' + cmds[i].name + '</option>';
        }
      }
      if ('function' == typeof (_params.success)) {
        _params.success(result);
      }
    }
  });
}
