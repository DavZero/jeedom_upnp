<?php
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

  try {
    require_once dirname(__FILE__) . '/../../../../core/php/core.inc.php';
    include_file('core', 'authentification', 'php');
    
    if (!isConnect('admin')) {
      throw new Exception(__('401 - Accès non autorisé', __FILE__));
    }
    
    if (init('action') == 'getDirectChildren') {
      $jsonData = array();
      
      $browseCmd = upnpCmd::byId(init('cmdId'));
      
      if (!is_object($browseCmd)) {
        throw new Exception(__('Commande', __FILE__).' '.init('cmdId').' '.__('non trouvée', __FILE__));
      }
      
      $option = array(
        'ObjectID' => init('node_id'),
        'BrowseFlag' => 'BrowseDirectChildren',
        'Filter' => '',
        'StartingIndex' => '0',
        'RequestedCount' => '0',
        'SortCriteria' => '',
        'WaitResponse' => true
      );
      
      if (init('node_id') =='#')
      {
        $jsonData[] = array(
          'id' => '0',
          'text' => 'ServeurRoot',
          'icon' => '',
          'data' => array('type' => 'container'),
          'state' => array(
          'opened'  =>  false,
          'disabled' => false,
          'selected' => false
          ),
          'children'  => true 
        );
      }
      else
      {
        $didlXML = new DomDocument();
        $response = json_decode($browseCmd->execute($option));
        $didlXML->loadXML($response->{'BrowseResponse'}[0]->{'Result'}[0]);
        
        foreach($didlXML->documentElement->getElementsByTagName("container") as $container)
        {
          $jsonData[] = array(
            'id' => $container->getAttribute("id"),
            'text' => $container->getElementsByTagName("title")->item(0)->nodeValue,
            'icon' => '',
            'data' => array('type' => 'container'),
            'state' => array(
            'opened'  =>  false,
            'disabled' => false,
            'selected' => false
            ),
            'children'  => true
          );
        }
        
        foreach($didlXML->documentElement->getElementsByTagName("item") as $item)
        {
          $icon = '';
          $upnpClass = $item->getElementsByTagName("class")->item(0)->nodeValue;
          if (strstr($upnpClass,'music') || strstr($upnpClass,'audio')) $icon = 'plugins/upnp/core/template/icons/audio.png';
          else if (strstr($upnpClass,'video') || strstr($upnpClass,'movie')) $icon = 'plugins/upnp/core/template/icons/video.png';
          else if (strstr($upnpClass,'image') || strstr($upnpClass,'photo')) $icon = 'plugins/upnp/core/template/icons/photo.png';
          
          $jsonData[] = array(
            'id' => $item->getAttribute("id"),
            'text' => $item->getElementsByTagName("title")->item(0)->nodeValue,
            'icon' => $icon,
            'data' => array('type' => 'item'),
            'state' => array(
            'opened'  =>  false,
            'disabled' => false,
            'selected' => false
            ),
            'children'  => false
          );
        }
      }
      
      echo json_encode($jsonData, JSON_UNESCAPED_UNICODE);
      die();
    }
    
    if (init('action') == 'getMetadata') {
      $jsonData = array();
      
      $browseCmd = upnpCmd::byId(init('cmdId'));
      
      if (!is_object($browseCmd)) {
        throw new Exception(__('Commande', __FILE__).' '.init('cmdId').' '.__('non trouvée', __FILE__));
      }
      
      $option = array(
        'ObjectID' => init('node_id'),
        'BrowseFlag' => 'BrowseMetadata',
        'Filter' => '',
        'StartingIndex' => '0',
        'RequestedCount' => '0',
        'SortCriteria' => '',
        'WaitResponse' => true
      );
      
      //Metadata au formatXML
      $metadata = json_decode($browseCmd->execute($option))->{'u:BrowseResponse'}[0]->{'Result'}[0];
      
      //echo htmlentities($metadata);
      //die();
      
      /*if ($metadata->{'item'})
        ajax::success($metadata->{'item'}[0]);
        else if ($metadata->{'container'})
        ajax::success($metadata->{'container'}[0]);
        else ajax::success($metadata);*/
      
      ajax::success($metadata);
    };
    
    throw new Exception(__('Aucune méthode correspondante à : ', __FILE__) . init('action'));
    /*     * *********Catch exeption*************** */
  } catch (Exception $e) {
    ajax::error(displayExeption($e), $e->getCode());
  }
?>
