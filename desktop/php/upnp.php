<?php
if (!isConnect('admin')) {
  throw new Exception('{{401 - Accès non autorisé}}');
}
sendVarToJS('eqType', 'upnp');
$eqLogics = eqLogic::byType('upnp');

/**
 * Vérifie l'existance d'une URL
 * @paramstring$url
 * @returnboolean
 */
/*function url_exists($url){
  if(!is_string($url) || strlen($url)==0)return false;
  try {
    //$essais = get_headers($url, 1);
    //if(preg_match("#[^a-z0-9]2[0-9]{2}([^a-z0-9].*)$#i",$essais[0]))return true;
  }catch(Exception $e){}
  
  return false;
}*/
function url_exists($url){
  $curl = curl_init();
  curl_setopt($curl, CURLOPT_URL, $url);
  curl_setopt($curl, CURLOPT_HEADER, true);
  curl_setopt($curl, CURLOPT_TIMEOUT, 1);
  curl_setopt($curl, CURLOPT_NOBODY, true);
  curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
  $data = curl_exec($curl);
  curl_close($curl);
  preg_match("/HTTP\/1\.[1|0]\s(\d{3})/",$data,$matches);
  return ($matches[1] == 200);
}
?>

<div class="row row-overflow">
  <div class="col-lg-2 col-md-3 col-sm-4">
    <div class="bs-sidebar">
      <ul id="ul_eqLogic" class="nav nav-list bs-sidenav">
        <!--<a class="btn btn-default eqLogicAction" style="width : 100%;margin-top : 5px;margin-bottom: 5px;" data-action="add"><i class="fa fa-plus-circle"></i> {{Ajouter Thermostat}}</a>-->
        <li class="filter" style="margin-bottom: 5px;"><input class="filter form-control input-sm" placeholder="{{Rechercher}}" style="width: 100%"/></li>
        <?php
        foreach ($eqLogics as $eqLogic) {
          echo '<li class="cursor li_eqLogic" data-eqLogic_id="' . $eqLogic->getId() . '"><a>' . $eqLogic->getHumanName(true) . '</a></li>';
        }
        ?>
      </ul>
    </div>
  </div>

  <div class="col-lg-10 col-md-9 col-sm-8 eqLogicThumbnailDisplay" style="border-left: solid 1px #EEE; padding-left: 25px;">
    <legend><i class="fa fa-table"></i> {{Mes equipements}} <a class="btn btn-default btn-xs pull-right expertModeVisible" id="bt_removeAll"> {{Supprimer tous}}</a></legend>
    <div class="eqLogicThumbnailContainer">
      <?php
      foreach ($eqLogics as $eqLogic) {
        echo '<div class="eqLogicDisplayCard cursor" data-eqLogic_id="' . $eqLogic->getId() . '" style="background-color : #ffffff; height : 200px;margin-bottom : 10px;padding : 5px;border-radius: 2px;width : 160px;margin-left : 10px;" >';
        echo "<center>";
        $icon = $eqLogic->getConfiguration('icon');
        if (!isset($icon) || $icon=='' || !url_exists($icon)) echo '<img src="plugins/upnp/doc/images/upnp_icon.png" height="105" width="95" />';
        else echo '<img src="'.$icon.'" height="100" width="100" />';
        echo "</center>";
        echo '<span style="font-size : 1.1em;position:relative; top : 15px;word-break: break-all;white-space: pre-wrap;word-wrap: break-word;"><center>' . $eqLogic->getHumanName(true, true) . '</center></span>';
        echo '</div>';
      }
      ?>
    </div>
  </div>
  <div class="col-lg-10 col-md-9 col-sm-8 eqLogic" style="border-left: solid 1px #EEE; padding-left: 25px;display: none;">
    <a class="btn btn-success eqLogicAction pull-right" data-action="save"><i class="fa fa-check-circle"></i> {{Sauvegarder}}</a>
    <a class="btn btn-danger eqLogicAction pull-right" data-action="remove"><i class="fa fa-minus-circle"></i> {{Supprimer}}</a>
    <a class="btn btn-default eqLogicAction pull-right" data-action="configure"><i class="fa fa-cogs"></i> {{Configuration avancée}}</a>

    <ul class="nav nav-tabs" role="tablist">
      <li role="presentation"><a href="#" class="eqLogicAction" aria-controls="home" role="tab" data-toggle="tab" data-action="returnToThumbnailDisplay"><i class="fa fa-arrow-circle-left"></i></a></li>
      <li role="presentation" class="active"><a href="#eqlogictab" aria-controls="home" role="tab" data-toggle="tab"><i class="fa fa-tachometer"></i> {{Equipement}}</a></li>
      <li role="presentation"><a href="#commandtab" aria-controls="profile" role="tab" data-toggle="tab"><i class="fa fa-list-alt"></i> {{Commandes}}</a></li>
    </ul>

    <div class="tab-content" style="height:calc(100% - 50px);overflow:auto;overflow-x: hidden;">
      <div role="tabpanel" class="tab-pane active" id="eqlogictab">
        <div class="row">
          <div class="col-sm-6">
            <form class="form-horizontal">
              <fieldset>
                <br/>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Nom de l'équipement}}</label>
                  <div class="col-sm-8">
                    <input type="text" class="eqLogicAttr form-control" data-l1key="id" style="display : none;" />
                    <input type="text" class="eqLogicAttr form-control" data-l1key="name" placeholder="{{Nom de l'équipement}}"/>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label" >{{Objet parent}}</label>
                  <div class="col-sm-8">
                    <select id="sel_object" class="eqLogicAttr form-control" data-l1key="object_id">
                      <option value="">{{Aucun}}</option>
                      <?php
                      foreach (object::all() as $object) {
                        echo '<option value="' . $object->getId() . '">' . $object->getName() . '</option>';
                      }
                      ?>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Catégorie}}</label>
                  <div class="col-sm-8">
                    <?php
                    foreach (jeedom::getConfiguration('eqLogic:category') as $key => $value) {
                      echo '<label class="checkbox-inline">';
                      echo '<input type="checkbox" class="eqLogicAttr" data-l1key="category" data-l2key="' . $key . '" />' . $value['name'];
                      echo '</label>';
                    }
                    ?>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label" >{{Activer}}</label>
                  <div class="col-sm-8">
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isEnable" checked/>{{Activer}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isVisible" checked/>{{Visible}}</label>
                  </div>
                </div>
                <div class="form-group displayOptions">
                  <label class="col-sm-3 control-label" >{{Affichage}}</label>
                  <div class="col-sm-8">
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="configuration" data-l2key="customDisplay" checked/>{{Affichage spécifique au service}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="configuration" data-l2key="displayUnmanagedCommand" checked/>{{Afficher les commandes complémentaires}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr expertModeVisible" data-l1key="configuration" data-l2key="standardDisplayOfCustomizedCommand" unchecked/>{{Afficher toutes les commandes en mode "standard", en plus de l'affichage spécifique}}</label>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{UDN}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="UDN" title="{{UDN}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Service ID}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="serviceId" title="{{Service ID}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Friendly Name}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="friendlyName" title="{{Friendly Name}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group expertModeVisible">
                  <label class="col-sm-3 control-label">{{Location}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="location" title="{{Location}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group expertModeVisible">
                  <label class="col-sm-3 control-label">{{Device Description}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="description" title="{{Description}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group expertModeVisible">
                  <label class="col-sm-3 control-label">{{Service Description}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="serviceDescription" title="{{serviceDescription}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
          <div class="col-sm-6">
            <form class="form-horizontal">
              <fieldset>
                <br/>
                <div id="eqLogicAdditionalData"></div>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
      <div role="tabpanel" class="tab-pane" id="commandtab">
        <br/>
        <table id="table_cmd" class="table table-bordered table-condensed">
          <thead>
            <tr>
              <!--<th>{{Nom}}</th><th>{{Source}}</th><th>{{Type}}</th><th>{{Nom UPnP}}</th><th>{{Options}}</th><th>{{Paramètre}}</th><th>{{Action}}</th>-->
              <th>{{Nom}}</th><th>{{Type}}</th><th>{{Nom UPnP}}</th><th>{{Options}}</th><th>{{Paramètre}}</th><th>{{Action}}</th>
            </tr>
          </thead>
          <tbody>

          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<?php include_file('desktop', 'upnp', 'js', 'upnp');?>
<?php include_file('core', 'plugin.template', 'js');?>
