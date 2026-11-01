import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { startDriverBackgroundLocation, stopDriverBackgroundLocation, getDriverBackgroundAssignment } from '../lib/driverBackgroundLocation';

const GREEN='#064E3B', INK='#172B24', MUTED='#687A72', LINE='#DCE8E1';
const labelStatus=s=>String(s||'assigned').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

function DriverNavigationMap({position,destination,address}) {
 const mapRef=useRef(null);
 const valid=p=>p&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))&&Math.abs(Number(p.latitude))<=90&&Math.abs(Number(p.longitude))<=180;
 const dest=valid(destination)?{latitude:Number(destination.latitude),longitude:Number(destination.longitude)}:null;
 const initial=valid(position)?{latitude:Number(position.latitude),longitude:Number(position.longitude)}:null;
 const html=React.useMemo(()=>{
  const d=dest;
  const center=d?[d.latitude,d.longitude]:[-15.4167,28.2833];
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#edf3ef}.driver-icon{background:#087F5B;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 1px 8px #064e3b88}.destination-icon{background:#D97706;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 1px 8px #78350f66}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var map=L.map("map",{zoomControl:true}).setView(['+center[0]+','+center[1]+'], '+(d?15:11)+');L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);var driverMarker=null,destinationMarker=null,routeLine=null,lastRouteAt=0,lastRoutePos=null;var dest='+JSON.stringify(d)+';if(dest){destinationMarker=L.marker([dest.latitude,dest.longitude],{icon:L.divIcon({className:"",html:"<div class=\\"destination-icon\\"></div>",iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map).bindPopup("Customer destination");}var animationFrame=null;function updateDriver(p){if(!p||!Number.isFinite(Number(p.latitude))||!Number.isFinite(Number(p.longitude)))return;var target=L.latLng(Number(p.latitude),Number(p.longitude));if(!driverMarker){driverMarker=L.marker(target,{icon:L.divIcon({className:"",html:"<div class=\\"driver-icon\\"></div>",iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map).bindPopup("Your live position");map.setView(target,17);}else{if(animationFrame)cancelAnimationFrame(animationFrame);var from=driverMarker.getLatLng(),started=performance.now(),duration=2600;function animate(now){var t=Math.min(1,(now-started)/duration);var eased=t*t*(3-2*t);driverMarker.setLatLng([from.lat+(target.lat-from.lat)*eased,from.lng+(target.lng-from.lng)*eased]);if(t<1)animationFrame=requestAnimationFrame(animate);else animationFrame=null;}animationFrame=requestAnimationFrame(animate);map.panTo(target,{animate:true,duration:2.6,easeLinearity:.18});}if(dest){var now=Date.now();var moved=!lastRoutePos||map.distance(target,lastRoutePos)>80;if((!routeLine||moved)&&now-lastRouteAt>30000){lastRouteAt=now;lastRoutePos=target;fetch("https://router.project-osrm.org/route/v1/driving/"+target.lng+","+target.lat+";"+dest.longitude+","+dest.latitude+"?overview=full&geometries=geojson").then(r=>r.json()).then(data=>{if(data.routes&&data.routes[0]){if(routeLine)map.removeLayer(routeLine);routeLine=L.geoJSON(data.routes[0].geometry,{style:{color:"#087F5B",weight:6,opacity:.9}}).addTo(map);}}).catch(()=>{});}}}window.addEventListener("message",function(e){try{var p=typeof e.data==="string"?JSON.parse(e.data):e.data;if(p&&p.type==="driver-position")updateDriver(p.position);}catch(_){}});window.updateDriver=updateDriver;</script></body></html>';
 },[dest?.latitude,dest?.longitude]);
 useEffect(()=>{
  if(!valid(position))return;
  const message=JSON.stringify({type:'driver-position',position:{latitude:Number(position.latitude),longitude:Number(position.longitude)}});
  if(Platform.OS==='web'){
   try{mapRef.current?.contentWindow?.postMessage(message,'*');}catch(_){}
  }else{
   try{mapRef.current?.postMessage(message);}catch(_){}
  }
 },[position?.latitude,position?.longitude]);
 const onMapReady=()=>{if(!initial)return;const message=JSON.stringify({type:'driver-position',position:initial});if(Platform.OS==='web'){try{mapRef.current?.contentWindow?.postMessage(message,'*');}catch(_){}}else{try{mapRef.current?.postMessage(message);}catch(_){}}};
 return <View style={{height:260,borderRadius:12,overflow:'hidden',backgroundColor:'#EDF3EF'}}>{Platform.OS==='web'?React.createElement('iframe',{ref:mapRef,title:'Route to customer',srcDoc:html,onLoad:onMapReady,style:{width:'100%',height:'100%',border:0,display:'block'}}):<WebView ref={mapRef} originWhitelist={['*']} source={{html}} javaScriptEnabled domStorageEnabled onLoadEnd={onMapReady} style={{flex:1}}/>}</View>;
}

export default function KanevDriverPortal({session,onSignOut}){
 const [driver,setDriver]=useState(null),[jobs,setJobs]=useState([]),[busy,setBusy]=useState(false),[trackingId,setTrackingId]=useState(null),[error,setError]=useState('');
 const watchRef=useRef(null);
 const trackingHeartbeatRef=useRef(null);
 const autoResumeAttemptRef=useRef(null);
 const [backgroundEnabled,setBackgroundEnabled]=useState(false);
 const [gpsStatus,setGpsStatus]=useState('Waiting for GPS fix…');
 const [lastGpsSent,setLastGpsSent]=useState(null);
 const [driverPosition,setDriverPosition]=useState(null);
 const load=useCallback(async()=>{
  if(!session?.user?.id)return;
  setBusy(true);setError('');
  try{
   const {data:d,error:de}=await supabase.from('delivery_drivers').select('*').eq('user_id',session.user.id).maybeSingle();
   if(de)throw de;if(!d||d.status!=='active'){try{await watchRef.current?.remove?.();}catch(_){}watchRef.current=null;setTrackingId(null);setBackgroundEnabled(false);await stopDriverBackgroundLocation();throw new Error('This account does not have active delivery-driver access.');}
   setDriver(d);
   const {data:a,error:ae}=await supabase.from('delivery_assignments').select('id,order_id,status,assigned_at,accepted_at,started_at,delivered_at,delivery_note').eq('driver_id',session.user.id).order('assigned_at',{ascending:false}).limit(30);
   if(ae)throw ae;
   const ids=(a||[]).map(x=>x.order_id);
   const {data:o,error:oe}=ids.length?await supabase.from('orders').select('id,order_number,customer_name,customer_phone,delivery_address,delivery_latitude,delivery_longitude,total_zmw,fulfilment,status').in('id',ids):{data:[],error:null};
   if(oe)throw oe;
   const byId=new Map((o||[]).map(x=>[x.id,x]));
   setJobs((a||[]).map(x=>({...x,order:byId.get(x.order_id)})));
  }catch(e){setError(e.message||'Could not load your deliveries.');setJobs([]);}
  finally{setBusy(false);}
 },[session?.user?.id]);
 useEffect(()=>{load();const ch=supabase.channel('driver-assignments-'+session?.user?.id).on('postgres_changes',{event:'*',schema:'public',table:'delivery_assignments',filter:'driver_id=eq.'+session?.user?.id},load).on('postgres_changes',{event:'*',schema:'public',table:'delivery_drivers',filter:'user_id=eq.'+session?.user?.id},load).subscribe();return()=>{supabase.removeChannel(ch);};},[load]);
 const stopTracking=async({stopBackground=false}={})=>{try{await watchRef.current?.remove?.();}catch(_){}watchRef.current=null;if(trackingHeartbeatRef.current){clearInterval(trackingHeartbeatRef.current);trackingHeartbeatRef.current=null;}setTrackingId(null);if(stopBackground){await stopDriverBackgroundLocation();setBackgroundEnabled(false);}};
 const startTracking=async(job)=>{
  if(!job||!['picked_up','in_transit'].includes(job.status))return;
  try{
   const permission=await Location.requestForegroundPermissionsAsync();
   if(permission.status!=='granted')throw new Error('Allow location access to share your live position with the customer.');
   await stopTracking();setTrackingId(job.id);
   if(Platform.OS!=='web'){try{const enabled=await startDriverBackgroundLocation(job.id,session.user.id);setBackgroundEnabled(enabled);}catch(bgError){setBackgroundEnabled(false);setError(bgError?.message||'Background location permission not granted. Foreground tracking remains available.');}}
   let sending=false;
   const send=async(position)=>{
    if(sending||!position?.coords)return;
    sending=true;setGpsStatus('GPS fix received; saving location…');
    try{
     const c=position.coords;
     // Never block delivery tracking on a strict accuracy threshold. Share the
     // best available fix immediately and report its estimated accuracy.
     setDriverPosition({latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy});
     const {error:e}=await supabase.from('delivery_driver_locations').upsert({
      driver_id:session.user.id,assignment_id:job.id,latitude:c.latitude,longitude:c.longitude,
      heading:c.heading,speed_mps:c.speed,accuracy_m:c.accuracy,recorded_at:new Date().toISOString()
     },{onConflict:'driver_id'});
     if(e){console.warn('Driver location update failed',e.message);setGpsStatus('Location upload failed: '+e.message);return;}
     setLastGpsSent(new Date());setGpsStatus('Location shared · estimated accuracy '+(Number.isFinite(c.accuracy)?Math.round(c.accuracy)+' m':'not reported'));
    }finally{sending=false;}
   };
   const getAndSend=async()=>{try{setGpsStatus('Requesting current GPS position…');const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});await send(position);}catch(e){console.warn('Driver GPS heartbeat failed',e?.message||e);setGpsStatus('GPS error: '+(e?.message||'Could not get current position'));}};
   await getAndSend();
   watchRef.current=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:5000,distanceInterval:5},send);
   // A 30-second heartbeat also refreshes the timestamp when the driver is stationary.
   trackingHeartbeatRef.current=setInterval(getAndSend,30000);
  }catch(e){setGpsStatus('GPS startup failed: '+(e?.message||'Unknown error'));setError(e.message||'Could not start location sharing.');await stopTracking();}
 };
 const update=async(job,status)=>{
  setBusy(true);setError('');
  try{
   const {error:e}=await supabase.rpc('driver_update_delivery',{p_assignment_id:job.id,p_status:status,p_note:null});
   if(e)throw e;
   if(status==='picked_up'||status==='in_transit')await startTracking({...job,status});
   if(status==='delivered')await stopTracking({stopBackground:true});
   await load();
  }catch(e){setError(e.message||'Delivery status could not be updated.');}
  finally{setBusy(false);}
 };
 useEffect(()=>{let mounted=true;getDriverBackgroundAssignment().then(active=>{if(mounted&&active?.driverId===session?.user?.id){setBackgroundEnabled(true);setTrackingId(active.assignmentId);}}).catch(()=>{});return()=>{mounted=false;watchRef.current?.remove?.();};},[session?.user?.id]);
 const active=jobs.filter(j=>!['delivered','cancelled'].includes(j.status));
 // Resume GPS after a driver reloads the portal during an already active delivery.
 useEffect(()=>{
  const job=jobs.find(j=>['picked_up','in_transit'].includes(j.status));
  if(!job){autoResumeAttemptRef.current=null;return;}
  if(trackingId===job.id||autoResumeAttemptRef.current===job.id)return;
  autoResumeAttemptRef.current=job.id;
  startTracking(job);
 },[jobs,trackingId]);
 useEffect(()=>{if(!jobs.length)return;getDriverBackgroundAssignment().then(stored=>{if(stored && !jobs.some(j=>j.id===stored.assignmentId && ['picked_up','in_transit'].includes(j.status))){stopDriverBackgroundLocation().then(()=>{setBackgroundEnabled(false);setTrackingId(null);});}}).catch(()=>{});},[jobs]);
 return <View style={{flex:1,backgroundColor:'#F4F8F5'}}>
  <View style={{backgroundColor:GREEN,paddingTop:Platform.OS==='android'?34:18,paddingHorizontal:18,paddingBottom:20,borderBottomLeftRadius:22,borderBottomRightRadius:22}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <View><Text style={{color:'#C8F36A',fontSize:10,fontWeight:'900',letterSpacing:1}}>KANEV PHARMACY</Text><Text style={{color:'#FFFFFF',fontSize:22,fontWeight:'900',marginTop:5}}>Driver dashboard</Text><Text style={{color:'#DCEBE3',fontSize:12,marginTop:4}}>Welcome, {driver?.full_name||'Driver'}</Text></View>
    <Pressable onPress={async()=>{await stopTracking({stopBackground:true});onSignOut?.();}} style={{padding:10,backgroundColor:'#FFFFFF20',borderRadius:12}}><Ionicons name="log-out-outline" size={21} color="#FFFFFF"/></Pressable>
   </View>
   <View style={{flexDirection:'row',gap:9,marginTop:17}}>
    <View style={{flex:1,backgroundColor:'#FFFFFF18',borderRadius:12,padding:12}}><Text style={{color:'#DCEBE3',fontSize:11}}>Active deliveries</Text><Text style={{color:'#FFFFFF',fontSize:23,fontWeight:'900'}}>{active.length}</Text></View>
    <View style={{flex:1,backgroundColor:'#FFFFFF18',borderRadius:12,padding:12}}><Text style={{color:'#DCEBE3',fontSize:11}}>Completed today</Text><Text style={{color:'#FFFFFF',fontSize:23,fontWeight:'900'}}>{jobs.filter(j=>j.status==='delivered'&&new Date(j.delivered_at||0).toDateString()===new Date().toDateString()).length}</Text></View>
   </View>
  </View>
  <ScrollView contentContainerStyle={{padding:15,paddingBottom:40,gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:17,fontWeight:'900',color:INK}}>My deliveries</Text><Pressable onPress={load}><Ionicons name="refresh" size={20} color={GREEN}/></Pressable></View>
   {error?<Text style={{color:'#B42318',fontSize:12,backgroundColor:'#FEECEB',padding:11,borderRadius:10}}>{error}</Text>:null}
   {busy&&!jobs.length?<ActivityIndicator color={GREEN}/>:null}
   {!busy&&!jobs.length?<View style={{backgroundColor:'#FFFFFF',padding:24,borderRadius:16,alignItems:'center',gap:8}}><Ionicons name="bicycle-outline" size={34} color={MUTED}/><Text style={{fontWeight:'800',color:INK}}>No deliveries assigned</Text><Text style={{fontSize:12,color:MUTED,textAlign:'center'}}>New deliveries assigned by Kanev Pharmacy will appear here.</Text></View>:null}
   {jobs.map(job=><View key={job.id} style={{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:LINE,borderRadius:16,padding:14,gap:9}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontWeight:'900',fontSize:14,color:INK}}>{job.order?.order_number||'Delivery order'}</Text><Text style={{fontSize:11,fontWeight:'800',color:GREEN}}>{labelStatus(job.status)}</Text></View>
    <Text style={{fontSize:13,fontWeight:'800',color:INK}}>{job.order?.customer_name||'Customer'}</Text>
    <Text style={{fontSize:12,color:MUTED}}>{job.order?.customer_phone||'No phone number'}</Text>
    <View style={{flexDirection:'row',gap:7,alignItems:'flex-start'}}><Ionicons name="location-outline" size={17} color={GREEN}/><Text style={{flex:1,fontSize:12,color:INK}}>{job.order?.delivery_address||'Delivery address not provided'}</Text></View>
    <Text style={{fontSize:12,color:MUTED}}>Order total: K{Number(job.order?.total_zmw||0).toFixed(2)}</Text>
    {job.status==='assigned'?<Pressable onPress={()=>update(job,'accepted')} style={{backgroundColor:GREEN,padding:12,borderRadius:10,alignItems:'center'}}><Text style={{color:'#FFFFFF',fontWeight:'900'}}>Accept delivery</Text></Pressable>:null}
    {job.status==='accepted'?<Pressable onPress={()=>update(job,'picked_up')} style={{backgroundColor:GREEN,padding:12,borderRadius:10,alignItems:'center'}}><Text style={{color:'#FFFFFF',fontWeight:'900'}}>Picked up — start route</Text></Pressable>:null}
    {['picked_up','in_transit'].includes(job.status)?<><Text style={{fontSize:13,fontWeight:'900',color:INK}}>Route to customer</Text><DriverNavigationMap position={driverPosition} destination={{latitude:job.order?.delivery_latitude,longitude:job.order?.delivery_longitude}} address={job.order?.delivery_address}/><Pressable onPress={()=>{const dest=job.order?.delivery_latitude&&job.order?.delivery_longitude?job.order.delivery_latitude+','+job.order.delivery_longitude:job.order?.delivery_address||'';if(dest)Linking.openURL('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest)+'&travelmode=driving');}} style={{backgroundColor:'#EAF5EE',padding:11,borderRadius:10,alignItems:'center'}}><Text style={{color:GREEN,fontWeight:'900'}}>Open turn-by-turn navigation in Google Maps</Text></Pressable><View style={{backgroundColor:'#EAF5EE',padding:10,borderRadius:9,flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name="radio-button-on" color={GREEN}/><Text style={{color:GREEN,fontSize:12,fontWeight:'800'}}>{trackingId===job.id?(backgroundEnabled?'Background GPS tracking active':'Foreground GPS tracking active'):'Delivery in progress'}</Text></View>{trackingId===job.id?<Text style={{fontSize:11,color:gpsStatus.includes('failed')||gpsStatus.includes('error')?'#B42318':MUTED}}>{gpsStatus}{lastGpsSent?' · Last sent '+lastGpsSent.toLocaleTimeString():''}</Text>:null}<Pressable onPress={()=>update(job,'delivered')} style={{backgroundColor:'#176B45',padding:12,borderRadius:10,alignItems:'center'}}><Text style={{color:'#FFFFFF',fontWeight:'900'}}>Mark as delivered</Text></Pressable></>:null}
   </View>)}
  </ScrollView>
 </View>;
}
