<?php
if (!isConnect('admin')) {
  throw new Exception('{{401 - Accès non autorisé}}');
}
sendVarToJS('eqType', 'upnp');
$plugin = plugin::byId('upnp');
$eqLogics = eqLogic::byType('upnp');
function url_exists($url)
{
  $curl = curl_init();
  curl_setopt($curl, CURLOPT_URL, $url);
  curl_setopt($curl, CURLOPT_HEADER, true);
  curl_setopt($curl, CURLOPT_TIMEOUT_MS, 20);
  //curl_setopt($curl, CURLOPT_TIMEOUT, 1);
  curl_setopt($curl, CURLOPT_NOBODY, true);
  curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
  $data = curl_exec($curl);
  curl_close($curl);
  preg_match("/HTTP\/1\.[1|0]\s(\d{3})/", $data, $matches);
  return ($matches[1] == 200);
}
?>

<div class="row row-overflow">
  <div class="col-xs-12 eqLogicThumbnailDisplay">
    <legend><i class="fas fa-cog"></i> {{Gestion}}</legend>
    <div class="eqLogicThumbnailContainer">
      <div class="cursor eqLogicAction logoSecondary" data-action="gotoPluginConf">
        <i class="fas fa-wrench"></i>
        <br>
        <span>{{Configuration}}</span>
      </div>
      <?php
      if (config::byKey('eqLogicIncludeState', 'upnp', 0) == 1) {
        echo '<div class="cursor changeIncludeState expertModeVisible logoSecondary" data-mode="1" data-state="0" >';
        echo '<i class="fas fa-sign-in-alt fa-rotate-90"></i>';
        echo '<br>';
        echo '<span>{{Arrêter inclusion}}</span>';
        echo '</div>';
      } else {
        echo '<div class="cursor changeIncludeState expertModeVisible logoSecondary" data-mode="1" data-state="1" >';
        echo '<br>';
        echo '<i class="fas fa-sign-in-alt fa-rotate-90"></i>';
        echo '<span >{{Mode inclusion}}</span>';
        echo '</div>';
      }
      ?>
      <div class="cursor expertModeVisible logoSecondary" id="bt_scanEqLogic">
        <i class="fas fa-sync"></i>
        <br>
        <span>{{Rechercher}}</span>
      </div>
    </div>
    <legend><i class="fas fa-table"></i> {{Mes equipements}} <a class="btn btn-default btn-xs pull-right expertModeVisible" id="bt_removeAll"> {{Supprimer tous}}</a></legend>
    <div class="eqLogicThumbnailContainer">
      <?php
      foreach ($eqLogics as $eqLogic) {
        $opacity = ($eqLogic->getIsEnable()) ? '' : 'disableCard';
        echo '  <div class="eqLogicDisplayCard cursor ' . $opacity . '" data-eqLogic_id="' . $eqLogic->getId() . '">';
        $icon = $eqLogic->getConfiguration('icon');
        if (!isset($icon) || $icon == '' || !url_exists($icon)) echo '   <img src="' . $plugin->getPathImgIcon() . '"/>'; //' height="100" width="100" />';
        else echo '<img src="' . $icon . '" />'; //' height="100" width="100" />';
        echo '   <br>';
        echo '   <span class="name">' . $eqLogic->getHumanName(true, true) . '</span>';
        echo ' </div>';
      }
      ?>
    </div>
  </div>

  <div class="col-xs-12 eqLogic" style="display: none;">
    <div class="input-group pull-right" style="display:inline-flex">
      <span class="input-group-btn">
        <a class="btn btn-default btn-sm eqLogicAction roundedLeft" data-action="configure"><i class="fas fa-cogs"></i> {{Configuration avancée}}</a>
        <a class="btn btn-sm btn-success eqLogicAction" data-action="save"><i class="fas fa-check-circle"></i> {{Sauvegarder}}</a>
        <a class="btn btn-danger btn-sm eqLogicAction roundedRight" data-action="remove"><i class="fas fa-minus-circle"></i> {{Supprimer}}</a>
      </span>
    </div>

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
                <br />
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Nom de l'équipement}}</label>
                  <div class="col-sm-8">
                    <input type="text" class="eqLogicAttr form-control" data-l1key="id" style="display : none;" />
                    <input type="text" class="eqLogicAttr form-control" data-l1key="name" placeholder="{{Nom de l'équipement}}" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Objet parent}}</label>
                  <div class="col-sm-8">
                    <select id="sel_object" class="eqLogicAttr form-control" data-l1key="object_id">
                      <option value="">{{Aucun}}</option>
                      <?php
                      foreach (jeeObject::all() as $object) {
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
                  <label class="col-sm-3 control-label">{{Activer}}</label>
                  <div class="col-sm-8">
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isEnable" checked />{{Activer}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isVisible" checked />{{Visible}}</label>
                  </div>
                </div>
                <div class="form-group displayOptions">
                  <label class="col-sm-3 control-label">{{Affichage}}</label>
                  <div class="col-sm-8">
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="configuration" data-l2key="customDisplay" checked />{{Affichage spécifique au service}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="configuration" data-l2key="displayUnmanagedCommand" checked />{{Afficher les commandes complémentaires}}</label>
                    <label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr expertModeVisible" data-l1key="configuration" data-l2key="standardDisplayOfCustomizedCommand" unchecked />{{Afficher toutes les commandes en mode "standard", en plus de l'affichage spécifique}}</label>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Device Type}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="deviceType" title="{{Device Type}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{UDN}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="UDN" title="{{UDN}}" style="font-size : 1em;cursor : default;"></span>
                  </div>
                </div>
                <div class="form-group expertModeVisible">
                  <label class="col-sm-3 control-label">{{Device Description}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="description" title="{{Description}}" style="font-size : 1em;cursor : default;"></span>
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
                <div class="form-group">
                  <label class="col-sm-3 control-label">{{Service ID}}</label>
                  <div class="col-sm-8">
                    <span class="eqLogicAttr label label-default" data-l1key="configuration" data-l2key="serviceId" title="{{Service ID}}" style="font-size : 1em;cursor : default;"></span>
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
                <br />
                <div id="eqLogicAdditionalData"></div>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
      <div role="tabpanel" class="tab-pane" id="commandtab">
        <br />
        <a class="btn btn-success btn-sm cmdAction pull-right" data-action="addUserCmd"><i class="fa fa-plus-circle"></i> Ajouter une commande</a><br /><br />
        <table id="table_cmd" class="table table-bordered table-condensed">
          <thead>
            <tr>
              <!--<th>{{Nom}}</th><th>{{Source}}</th><th>{{Type}}</th><th>{{Nom UPnP}}</th><th>{{Options}}</th><th>{{Paramètre}}</th><th>{{Action}}</th>-->
              <th>{{Nom}}</th>
              <th>{{Type}}</th>
              <th>{{Nom UPnP}}</th>
              <th>{{Options}}</th>
              <th>{{Paramètre}}</th>
              <th>{{Action}}</th>
            </tr>
          </thead>
          <tbody>

          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<?php include_file('desktop', 'upnp', 'js', 'upnp'); ?>
<?php include_file('core', 'plugin.template', 'js'); ?>