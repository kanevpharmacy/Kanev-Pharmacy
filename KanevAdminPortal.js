import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, ScrollView, Pressable, StyleSheet, useWindowDimensions, ActivityIndicator, Alert, Platform, Image, Linking, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { supabase, supabaseConfigured } from './src/lib/supabase';
import { WebView } from 'react-native-webview';
import KanevNoticeModal from './src/components/KanevNoticeModal';

const GREEN = '#064E3B', LIME = '#C8F36A', INK = '#172B24', MUTED = '#687A72', LINE = '#DCE8E1', BG = '#F4F8F5', BLUE = '#236DA8';
const money = n => `K${Number(n || 0).toLocaleString('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const healthDocumentNumber = (doc) => `${doc?.document_type === 'prescription' ? 'RX' : 'LAB'}-${doc?.created_at ? new Date(doc.created_at).toISOString().slice(0,10).replaceAll('-','') : 'DOC'}-${String(doc?.id || '').replace(/-/g,'').slice(0,6).toUpperCase() || 'NEW'}`;
const menu = [
  ['Overview','grid-outline'], ['Banners','images-outline'], ['Homepage Categories','layers-outline'], ['Orders','receipt-outline'], ['Products','medkit-outline'], ['Categories','albums-outline'], ['Menu Management','list-outline'],
  ['Inventory','file-tray-stacked-outline'], ['Prescriptions','document-text-outline'], ['Customers','people-outline'], ['Reports','bar-chart-outline'], ['Login Branding','color-palette-outline'], ['Settings','settings-outline']
];
function Btn({children,onPress,outline=false,disabled=false}) { return <Pressable onPress={onPress} disabled={disabled} style={[s.btn,outline&&s.btnOutline,disabled&&{opacity:.55}]}><Text style={[s.btnText,outline&&{color:GREEN}]}>{children}</Text></Pressable> }
function Field({label,value,onChangeText,placeholder,secureTextEntry,keyboardType='default'}) { return <View style={{gap:6,marginBottom:12}}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder||label} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={keyboardType==='email-address'?'none':'sentences'} style={s.input} placeholderTextColor="#91A099" /></View> }
function Metric({icon,label,value,sub,color=GREEN}) { return <View style={s.metric}><View style={[s.metricIcon,{backgroundColor:color+'14'}]}><Ionicons name={icon} size={21} color={color}/></View><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text><Text style={s.metricSub}>{sub}</Text></View> }

const FONT_FAMILIES = [
  {label:'System (recommended)',value:'System',note:'Uses the device default'},
  {label:'Arial',value:'Arial',note:'Clean and familiar'},
  {label:'Helvetica',value:'Helvetica',note:'Modern and minimal'},
  {label:'Inter',value:'Inter',note:'Professional app interface'},
  {label:'Roboto',value:'Roboto',note:'Mobile-friendly and clear'},
  {label:'Open Sans',value:'Open Sans',note:'Readable body text'},
  {label:'Lato',value:'Lato',note:'Friendly and polished'},
  {label:'Poppins',value:'Poppins',note:'Strong headings'},
  {label:'Montserrat',value:'Montserrat',note:'Brand titles'},
  {label:'Nunito Sans',value:'Nunito Sans',note:'Approachable interface'},
  {label:'Source Sans 3',value:'Source Sans 3',note:'Business interface'},
  {label:'Ubuntu',value:'Ubuntu',note:'Modern and distinctive'},
  {label:'Trebuchet MS',value:'Trebuchet MS',note:'Friendly headings'},
  {label:'Verdana',value:'Verdana',note:'Highly readable'},
  {label:'Georgia',value:'Georgia',note:'Elegant headings'},
  {label:'Merriweather',value:'Merriweather',note:'Editorial-style headings'},
  {label:'Times New Roman',value:'Times New Roman',note:'Traditional style'},
  {label:'Playfair Display',value:'Playfair Display',note:'Premium brand headings'},
  {label:'Courier New',value:'Courier New',note:'Monospaced style'},
  {label:'DM Sans',value:'DM Sans',note:'Clean contemporary interface'},
];
const COLOR_PALETTE = [
  '#FFFFFF','#F8FAFC','#D8EAE2','#C8F36A','#B7E4C7','#86EFAC',
  '#064E3B','#0B4B38','#172B24','#374151','#687A72','#111827',
  '#236DA8','#1769FF','#7C3AED','#DB2777','#D97706','#DC2626',
  '#000000','#475569','#94A3B8','#FDE68A','#FED7AA','#FECACA'
];
function AppearancePicker({label,value,onChange,kind='color'}) {
  const [open,setOpen] = React.useState(false);
  const selected = value || (kind==='color'?'#FFFFFF':'System');
  return <View style={{marginBottom:13,gap:6}}>
    <Text style={s.label}>{label}</Text>
    {kind==='color' ? <>
      <Pressable onPress={()=>setOpen(!open)} style={{minHeight:44,borderWidth:1,borderColor:LINE,borderRadius:10,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#fff'}}>
        <View style={{width:25,height:25,borderRadius:7,backgroundColor:selected,borderWidth:1,borderColor:'#CBD5D1'}}/>
        <Text style={{color:INK,fontSize:13,flex:1}}>{selected.toUpperCase()}</Text>
        <Text style={{color:GREEN,fontWeight:'800'}}>{open?'Close':'Choose colour ▾'}</Text>
      </Pressable>
      {open ? <View style={{flexDirection:'row',flexWrap:'wrap',gap:9,padding:12,borderWidth:1,borderColor:LINE,borderRadius:12,backgroundColor:'#FAFCFB'}}>
        {COLOR_PALETTE.map(c=><Pressable key={c} onPress={()=>{onChange(c);setOpen(false)}} accessibilityLabel={`Choose ${c}`} style={{width:31,height:31,borderRadius:16,backgroundColor:c,borderWidth:selected.toLowerCase()===c.toLowerCase()?3:1,borderColor:selected.toLowerCase()===c.toLowerCase()?GREEN:'#CBD5D1',alignItems:'center',justifyContent:'center'}}>
          {selected.toLowerCase()===c.toLowerCase() ? <Text style={{fontSize:13,color:['#FFFFFF','#F8FAFC','#D8EAE2','#C8F36A','#B7E4C7','#86EFAC','#FDE68A','#FED7AA','#FECACA'].includes(c)?'#064E3B':'#FFFFFF'}}>✓</Text>:null}
        </Pressable>)}
      </View>:null}
    </> : <>
      <Pressable onPress={()=>setOpen(!open)} accessibilityRole="button"
        accessibilityLabel={`${label}: ${FONT_FAMILIES.find(f=>f.value===selected)?.label||selected}. ${open?'Close':'Open'} font choices`}
        style={{minHeight:44,borderWidth:1,borderColor:LINE,borderRadius:10,paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,backgroundColor:'#fff'}}>
        <View style={{flex:1,gap:3}}>
          <Text style={{fontSize:14,color:INK,fontFamily:selected==='System'?undefined:selected,fontWeight:'600'}}>
            {FONT_FAMILIES.find(f=>f.value===selected)?.label||selected}
          </Text>
          <Text numberOfLines={1} style={{fontSize:11,color:MUTED,fontFamily:selected==='System'?undefined:selected}}>
            Kanev Pharmacy · Closer to Your Health
          </Text>
        </View>
        <Text style={{color:GREEN,fontWeight:'800'}}>{open?'Close':'Choose font ▾'}</Text>
      </Pressable>
      {open ? <ScrollView nestedScrollEnabled style={{maxHeight:290,borderWidth:1,borderColor:LINE,borderRadius:10,backgroundColor:'#fff'}} keyboardShouldPersistTaps="handled">
        {FONT_FAMILIES.map((f,index)=><Pressable key={f.value} onPress={()=>{onChange(f.value);setOpen(false)}} accessibilityRole="button"
          accessibilityLabel={`Select ${f.label}`}
          style={{paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,backgroundColor:selected===f.value?'#EAF5EE':'#fff',borderBottomWidth:index===FONT_FAMILIES.length-1?0:1,borderBottomColor:'#EDF2EE'}}>
          <View style={{flex:1,gap:3}}>
            <Text style={{fontSize:14,color:INK,fontFamily:f.value==='System'?undefined:f.value,fontWeight:selected===f.value?'700':'400'}}>{f.label}</Text>
            <Text style={{fontSize:11,color:MUTED}}>{f.note}</Text>
            <Text numberOfLines={1} style={{fontSize:12,color:INK,fontFamily:f.value==='System'?undefined:f.value}}>Kanev Pharmacy — Closer to Your Health</Text>
          </View>
          {selected===f.value?<Ionicons name="checkmark-circle" size={19} color={GREEN}/>:null}
        </Pressable>)}
      </ScrollView>:null}
    </>}
  </View>;
}

export default function KanevAdminPortal(){
 const {width}=useWindowDimensions(); const desktop=width>=980; const [session,setSession]=useState(null); const [role,setRole]=useState(''); const [checking,setChecking]=useState(true); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [page,setPage]=useState('Overview'); const [error,setError]=useState(''); const [documentPreview,setDocumentPreview]=useState(null); const [documentPreviewLoading,setDocumentPreviewLoading]=useState(false);
 const [stats,setStats]=useState({orders:0,pending:0,products:0,customers:0,revenue:0}); const [orders,setOrders]=useState([]); const [healthDocuments,setHealthDocuments]=useState([]); const [healthDocBusyId,setHealthDocBusyId]=useState(null);
 const [expandedHealthDocumentId,setExpandedHealthDocumentId]=useState(null); const [healthDocFeedback,setHealthDocFeedback]=useState({}); const [healthDocMessages,setHealthDocMessages]=useState({}); const [healthDocSendingId,setHealthDocSendingId]=useState(null); const [healthDocFilter,setHealthDocFilter]=useState('all'); const [expandedAdminOrderId,setExpandedAdminOrderId]=useState(null); const [expandedOrderId,setExpandedOrderId]=useState(null); const [orderItemsById,setOrderItemsById]=useState({}); const [orderItemsLoadingId,setOrderItemsLoadingId]=useState(null); const [products,setProducts]=useState([]); const [customers,setCustomers]=useState([]); const [categories,setCategories]=useState([]); const [loading,setLoading]=useState(false); const [search,setSearch]=useState('');
 const emptyProductForm={id:null,name:'',slug:'',summary:'',description:'',price_zmw:'',original_price_zmw:'',rating:'5.0',stock_quantity:'0',low_stock_threshold:'5',expiry_date:'',brand:'',sku:'',image_url:'',image_urls:[],category_id:'',category_ids:[],is_active:true,requires_prescription:false,scheduled_at:''};
 const [productForm,setProductForm]=useState(emptyProductForm);
 const [productImageUploading,setProductImageUploading]=useState(false); const [newCategoryName,setNewCategoryName]=useState(''); const [categoryEditId,setCategoryEditId]=useState(null); const [categoryEditName,setCategoryEditName]=useState(''); const [categoryEditActive,setCategoryEditActive]=useState(true); const [categorySaving,setCategorySaving]=useState(false); const [newCategoryImageUrl,setNewCategoryImageUrl]=useState(''); const [categoryImageBusyId,setCategoryImageBusyId]=useState(null); const [newCategoryImageBusy,setNewCategoryImageBusy]=useState(false);
 const defaultBranding={id:'default',homepage_category_ids:[],pharmacy_title:'Kanev Pharmacy',tagline:'Closer to Your Health',logo_left_url:'',logo_form_url:'',header_logo_url:'',left_background_image_url:'',left_background_color:'#0B4B38',left_heading:'Closer to your health.',left_description:'Everyday essentials, trusted pharmacy care and a simpler way to look after your family.',benefit_one:'Your account, handled securely',benefit_two:'Keep track of your orders',benefit_three:'Care for every day',left_heading_color:'#FFFFFF',left_heading_size:29,left_heading_style:'bold',left_description_color:'#D8EAE2',left_description_size:13,left_description_style:'normal',benefit_color:'#F2FBF5',benefit_size:12,benefit_style:'bold',brand_title_color:'#0B4B38',brand_title_size:15,brand_title_style:'bold',tagline_color:'#246EB0',tagline_size:10,tagline_style:'normal',right_eyebrow_color:'#16805B',right_eyebrow_size:10,right_eyebrow_style:'bold',right_heading_color:'#172B24',right_heading_size:18,right_heading_style:'bold',right_intro_color:'#718078',right_intro_size:12,right_intro_style:'normal',left_heading_font_family:'System',left_description_font_family:'System',benefit_font_family:'System',brand_title_font_family:'System',tagline_font_family:'System',right_eyebrow_font_family:'System',right_heading_font_family:'System',right_intro_font_family:'System'};
 const [branding,setBranding]=useState(defaultBranding);
 const homepageSelectionDirty=useRef(false);
 const [brandingSaving,setBrandingSaving]=useState(false);
 const [banners,setBanners]=useState([]); const emptyBannerForm={id:null,name:'',placement:'hero',eyebrow:'',title:'',description:'',button_text:'Shop now',link_url:'',image_url:'',image_urls:[],slideshow_type:'automatic',slideshow_effect:'slide-left',image_size:'placement',image_fit:'cover',mobile_image_url:'',background_color:'#0B4B38',text_color:'#FFFFFF',eyebrow_color:'#C8F36A',button_color:'#C8F36A',sort_order:'0',is_active:true,starts_at:'',ends_at:''}; const [bannerForm,setBannerForm]=useState(emptyBannerForm); const [bannerSaving,setBannerSaving]=useState(false); const [bannerImageBusy,setBannerImageBusy]=useState(false);
 const [menuItems,setMenuItems]=useState([]); const [menuForm,setMenuForm]=useState({id:null,label:'',node_type:'menu',parent_id:'',sort_order:'0',is_active:true,destination_type:'category',destination_value:''});
 useEffect(()=>{let alive=true; (async()=>{if(!supabaseConfigured){if(alive){setChecking(false);setError('Administration services are not available right now. Check the app configuration or contact your system administrator.')}return;} const {data}=await supabase.auth.getSession(); if(alive&&data.session){setSession(data.session); await verifyAdmin(data.session,alive);} else if(alive)setChecking(false);})(); const {data:listener}=supabase.auth.onAuthStateChange((_e,next)=>{if(alive){setSession(next); if(!next){setRole('');setChecking(false);}}}); return ()=>{alive=false;listener?.subscription?.unsubscribe?.();};},[]);
 async function verifyAdmin(ses,alive=true){setChecking(true);setError(''); try {const {data,error:e}=await supabase.from('admin_members').select('role').eq('user_id',ses.user.id).maybeSingle(); if(e)throw e; if(!data){await supabase.auth.signOut();setError('This account is not registered as a Kanev Pharmacy administrator. Ask the owner to grant access.');setRole('');} else {setRole(data.role); await loadData(); await loadHealthDocuments(ses.user.id);}} catch(e){setError('We could not verify your administrator access. Please try again, and contact the system owner if the issue continues.');} finally{setChecking(false);} }
 async function signIn(){setBusy(true);setError('');try{const {data,error:e}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(e)throw e;if(data.session){setSession(data.session);await verifyAdmin(data.session);}}catch(e){setError('We could not sign you in with those details. Check your email and password, then try again.');}finally{setBusy(false);}}
 useEffect(()=>{
  if(!supabaseConfigured || !session?.user?.id || !role) return undefined;
  let active=true;
  const userId=session.user.id;
  // Realtime gives immediate updates when the tables are in supabase_realtime.
  // Short polling is a safety net so new submissions and unread badges still
  // appear if a Realtime publication/channel drops or is misconfigured.
  const refreshDocuments=()=>{if(active) loadHealthDocuments(userId);};
  const channel=supabase.channel(`kanev-admin-live-${userId}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{if(active)loadData();})
   .on('postgres_changes',{event:'*',schema:'public',table:'order_tracking_events'},()=>{if(active)loadData();})
   .on('postgres_changes',{event:'*',schema:'public',table:'customer_health_documents'},refreshDocuments)
   .on('postgres_changes',{event:'*',schema:'public',table:'customer_health_document_messages'},refreshDocuments)
   .subscribe((status)=>{if(status==='SUBSCRIBED')refreshDocuments();});
  const documentsPoll=setInterval(refreshDocuments,5000);
  const ordersPoll=setInterval(()=>{if(active)loadData();},15000);
  return ()=>{active=false;clearInterval(documentsPoll);clearInterval(ordersPoll);supabase.removeChannel(channel);};
 },[session?.user?.id,role]);
 // Fetch health documents after the verified session is available, including on a full reload.
 useEffect(()=>{if(session?.user?.id && role) loadHealthDocuments(session.user.id);},[session?.user?.id,role]);
 async function loadData(){
  if(!supabaseConfigured)return;
  setLoading(true);
  try{
    const {data:brandRow}=await supabase.from('app_login_branding').select('*').eq('id','default').maybeSingle();
    if(brandRow && !homepageSelectionDirty.current)setBranding({...defaultBranding,...brandRow});
    // Use the real schema column `fulfilment` (not `fulfilment_method`). A single
    // missing column makes PostgREST reject the whole orders query and hides every order.
    const [o,p,c,cat]=await Promise.all([
      supabase.from('orders').select('id,order_number,status,total_zmw,subtotal_zmw,delivery_fee_zmw,customer_id,customer_name,customer_phone,delivery_address,fulfilment,created_at,updated_at,delivery_status,delivery_notes,delivery_latitude,delivery_longitude,tracking_code,delivery_partner,dispatched_at,delivered_at,prescription_review_status').order('created_at',{ascending:false}).limit(100),
      supabase.from('products').select('id,name,slug,summary,description,brand,sku,image_url,price_zmw,stock_quantity,low_stock_threshold,expiry_date,is_active,requires_prescription,category_id,scheduled_at,created_at,updated_at').order('created_at',{ascending:false}),
      supabase.from('customer_profiles').select('user_id,full_name,phone,created_at').order('created_at',{ascending:false}).limit(250),
      supabase.from('categories').select('id,name,slug,is_active,image_url').order('name')
    ]);
    if(o.error){setOrders([]);setError(`Orders could not be loaded: ${o.error.message}. Check the orders table permissions and schema.`);}else setOrders(o.data||[]);
    if(p.error){
      setProducts([]);
      setError(`Products could not be loaded: ${p.error.message}. Check the products table columns and administrator SELECT policy.`);
    }else{
      // Load category links separately instead of embedding categories(name) in the
      // products query. This avoids relationship-cache errors hiding the catalogue.
      const {data:assignmentRows,error:assignmentError}=await supabase.from('product_categories').select('product_id,category_id');
      const assignmentsByProduct={};
      if(!assignmentError)(assignmentRows||[]).forEach(link=>{(assignmentsByProduct[link.product_id] ||= []).push(link.category_id);});
      setProducts((p.data||[]).map(product=>({...product,category_ids:assignmentsByProduct[product.id]?.length?assignmentsByProduct[product.id]:product.category_id?[product.category_id]:[]})));
    }
    if(!c.error)setCustomers(c.data||[]);if(!cat.error)setCategories(cat.data||[]);
    const {data:menuRows,error:menuError}=await supabase.from('store_menu_items').select('*').order('sort_order');if(!menuError)setMenuItems(menuRows||[]);
     const {data:bannerRows,error:bannerError}=await supabase.from('store_banners').select('*').order('sort_order');if(!bannerError)setBanners(bannerRows||[]);
    const allOrders=o.data||[];
    setStats({orders:allOrders.length,pending:allOrders.filter(x=>['pending_review','pending','submitted','awaiting_review'].includes(String(x.status).toLowerCase())).length,products:p.data?.length||0,customers:c.data?.length||0,revenue:allOrders.filter(x=>['paid','completed','delivered'].includes(String(x.status).toLowerCase())).reduce((a,x)=>a+Number(x.total_zmw||0),0)});
  }catch(e){setError(`The dashboard could not refresh: ${e?.message||'please try again.'}`);}finally{setLoading(false);}
}
 async function loadHealthDocuments(userId=session?.user?.id){
  if(!supabaseConfigured || !userId)return;
  const {data,error:e}=await supabase.from('customer_health_documents').select('id,customer_id,document_type,title,notes,file_path,file_name,mime_type,file_size,status,admin_feedback,reviewed_by,reviewed_at,created_at,updated_at,conversation_closed_at').order('created_at',{ascending:false}).limit(200);
  if(e){setError(`Health documents could not be loaded: ${e.message}`);return;}
  const docs=data||[];setHealthDocuments(docs);
  if(!docs.length){setHealthDocMessages({});return;}
  const {data:messages,error:me}=await supabase.from('customer_health_document_messages').select('id,document_id,sender_id,sender_role,message,created_at').in('document_id',docs.map(d=>d.id)).order('created_at',{ascending:true});
  if(!me){const grouped={};(messages||[]).forEach(m=>{(grouped[m.document_id] ||= []).push(m);});setHealthDocMessages(grouped);}
  else setError(`Conversation messages could not be loaded: ${me.message}`);
 }
 async function updateHealthDocument(doc,nextStatus){
  if(!doc?.id)return;
  setHealthDocBusyId(doc.id);setError('');
  try{
   const feedback=String(healthDocFeedback[doc.id]??'').trim();
   if(nextStatus==='feedback_sent' && feedback){await sendHealthDocumentReply(doc);return;}
   const patch={status:nextStatus,reviewed_by:session.user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   const {data,error:e}=await supabase.from('customer_health_documents').update(patch).eq('id',doc.id).select('id,status,admin_feedback,reviewed_at,conversation_closed_at').maybeSingle();
   if(e)throw e;if(!data)throw new Error('No record was updated. Check administrator permissions and the migration.');
   setHealthDocuments(prev=>prev.map(x=>x.id===doc.id?{...x,...data}:x));setError('Review status saved.');
  }catch(e){setError(`Review could not be saved: ${e?.message||'check permissions and try again.'}`);}
  finally{setHealthDocBusyId(null);}
 }
 async function sendHealthDocumentReply(doc){
  const message=String(healthDocFeedback[doc.id]||'').trim();
  if(!message){setError('Write a message before sending feedback.');return;}
  if(!session?.user?.id)return;
  setHealthDocSendingId(doc.id);setError('');
  try{
   const {data:current,error:re}=await supabase.from('customer_health_documents').select('conversation_closed_at').eq('id',doc.id).maybeSingle();
   if(re)throw re;if(current?.conversation_closed_at)throw new Error('This conversation is closed. Reopen it before sending a message.');
   const {error:ie}=await supabase.from('customer_health_document_messages').insert({document_id:doc.id,sender_id:session.user.id,sender_role:'admin',message});
   if(ie)throw ie;
   const {error:ue}=await supabase.from('customer_health_documents').update({status:'feedback_sent',admin_feedback:message,reviewed_by:session.user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',doc.id);
   if(ue)throw ue;
   setHealthDocFeedback(prev=>({...prev,[doc.id]:''}));await loadHealthDocuments(session.user.id);setError('Message sent to the customer.');
  }catch(e){setError(`Message could not be sent: ${e?.message||'please try again.'}`);}
  finally{setHealthDocSendingId(null);}
 }
 async function setHealthConversationClosed(doc,closed){
  if(!doc?.id||!session?.user?.id)return;
  setHealthDocBusyId(doc.id);setError('');
  try{
   const patch=closed?{conversation_closed_at:new Date().toISOString(),conversation_closed_by:session.user.id,updated_at:new Date().toISOString()}:{conversation_closed_at:null,conversation_closed_by:null,updated_at:new Date().toISOString()};
   const {data,error:e}=await supabase.from('customer_health_documents').update(patch).eq('id',doc.id).select('id,conversation_closed_at,conversation_closed_by').maybeSingle();
   if(e)throw e;if(!data)throw new Error('No record was updated. Check administrator permissions.');
   setHealthDocuments(prev=>prev.map(x=>x.id===doc.id?{...x,...data}:x));setError(closed?'Conversation closed. The customer can no longer reply.':'Conversation reopened. The customer can reply again.');
  }catch(e){setError(`Conversation could not be ${closed?'closed':'reopened'}: ${e?.message||'please try again.'}`);}
  finally{setHealthDocBusyId(null);}
 }
 async function openHealthDocument(doc){
  setDocumentPreviewLoading(true);setDocumentPreview({title:doc.file_name||doc.title||'Health document',url:null,mime:doc.mime_type||''});
  try{const {data,error:e}=await supabase.storage.from('customer-health-documents').createSignedUrl(doc.file_path,300);if(e)throw e;if(!data?.signedUrl)throw new Error('A secure document link could not be created.');setDocumentPreview({title:doc.file_name||doc.title||'Health document',url:data.signedUrl,mime:doc.mime_type||''});}
  catch(e){setDocumentPreview(null);setError(`Document could not be opened: ${e?.message||'check private storage access.'}`);}
  finally{setDocumentPreviewLoading(false);}
 }
 async function chooseProductImage(){
  try{
   setError('');
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(permission?.granted===false){setError('Please allow access to your photos/files to choose product images.');return;}
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:8,quality:0.82});
   if(result.canceled||!result.assets?.length)return;
   setProductImageUploading(true);
   const uploaded=[];
   for(const asset of result.assets){
    const mime=asset.mimeType||'image/jpeg';
    const ext=(asset.fileName?.split('.').pop()||mime.split('/').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    if(!['jpg','jpeg','png','webp'].includes(ext))throw new Error('Choose JPG, PNG or WebP images only.');
    if(asset.fileSize&&asset.fileSize>5*1024*1024)throw new Error('Each product image must be smaller than 5 MB.');
    const response=await fetch(asset.uri);const blob=await response.blob();
    const path=`products/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error:uploadError}=await supabase.storage.from('product-images').upload(path,blob,{upsert:false,contentType:mime,cacheControl:'31536000'});
    if(uploadError)throw uploadError;
    uploaded.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
   }
   setProductForm(prev=>{const images=Array.from(new Set([...(prev.image_urls||[]),...uploaded]));return {...prev,image_urls:images,image_url:prev.image_url||images[0]||''};});
   setError(`${uploaded.length} product image(s) uploaded. Save the product to publish them.`);
  }catch(e){setError(`Product image upload failed: ${e?.message||'check product-images storage permissions.'}`);}
  finally{setProductImageUploading(false);}
 }
 async function uploadCategoryImage(categoryId=null){
  const setBusy=categoryId?setCategoryImageBusyId:setNewCategoryImageBusy;
  try{
   setError('');
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(permission?.granted===false){setError('Please allow access to your photos/files to choose a category image.');return;}
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.78});
   if(result.canceled||!result.assets?.[0])return;
   const asset=result.assets[0]; const mime=asset.mimeType||'image/jpeg';
   const ext=(asset.fileName?.split('.').pop()||mime.split('/').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
   if(!['jpg','jpeg','png','webp'].includes(ext)){setError('Choose a JPG, PNG or WebP image.');return;}
   if(asset.fileSize&&asset.fileSize>5*1024*1024){setError('Choose an image smaller than 5 MB.');return;}
   setBusy(categoryId||true);
   const response=await fetch(asset.uri); const blob=await response.blob();
   const owner=session?.user?.id||'admin';
   const path=`categories/${owner}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
   const {error:uploadError}=await supabase.storage.from('product-images').upload(path,blob,{upsert:false,contentType:mime,cacheControl:'31536000'});
   if(uploadError)throw uploadError;
   const {data}=supabase.storage.from('product-images').getPublicUrl(path);
   if(categoryId){
    const {data:updated,error:updateError}=await supabase.from('categories').update({image_url:data.publicUrl}).eq('id',categoryId).select('id,name,slug,is_active,image_url').single();
    if(updateError)throw updateError;
    setCategories(prev=>prev.map(c=>c.id===categoryId?updated:c));
    setError('Category image saved and published to the storefront.');
   }else{setNewCategoryImageUrl(data.publicUrl);setError('Image uploaded. Add the category to save it.');}
  }catch(e){setError(`Category image upload failed: ${e?.message||'check product-images storage permissions and the categories image_url migration.'}`);}
  finally{setBusy(categoryId?null:false);}
 }
 async function createCatalogueCategory(){
  const name=newCategoryName.trim(); if(!name){setError('Enter a category name first.');return;}
  if(categories.some(c=>normalizeCategoryName(c.name)===normalizeCategoryName(name))){setError('A category with the same name already exists (ignoring spaces, punctuation and capitalisation). Use the existing category so product assignments stay consistent.');return;}
  setCategorySaving(true);setError('');
  try{
   const base=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'category';
   const {data:existingRows,error:existingError}=await supabase.from('categories').select('slug');if(existingError)throw existingError;
   const used=new Set((existingRows||[]).map(x=>String(x.slug||'').toLowerCase()));let slug=base,n=2;while(used.has(slug.toLowerCase()))slug=`${base}-${n++}`;
   const {data,error:e}=await supabase.from('categories').insert({name,slug,is_active:true,image_url:newCategoryImageUrl||null}).select('id,name,slug,is_active,image_url').single();if(e)throw e;setCategories(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));setProductForm(prev=>({...prev,category_id:prev.category_id||data.id,category_ids:Array.from(new Set([...(prev.category_ids||[]),data.id]))}));setNewCategoryName('');setNewCategoryImageUrl('');setError('Product category created and selected.');
  }
  catch(e){setError(`Category could not be created: ${e?.message||'check category-table permissions and required columns.'}`);}
  finally{setCategorySaving(false);}
 }
 async function saveCategoryEdits(category){
  const name=String(categoryEditName||'').trim();
  if(!category?.id){setError('Cannot edit this category because its ID is missing.');return;}
  if(!name){setError('Enter a category name before saving.');return;}
  const duplicate=categories.find(c=>c.id!==category.id&&String(c.name||'').trim().toLowerCase()===name.toLowerCase());
  if(duplicate){setError(`A category named “${name}” already exists.`);return;}
  setCategorySaving(true);setError('');
  try{
   const base=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'category';
   const {data:slugRows,error:slugError}=await supabase.from('categories').select('id,slug');
   if(slugError)throw slugError;
   const used=new Set((slugRows||[]).filter(row=>row.id!==category.id).map(row=>String(row.slug||'').trim().toLowerCase()).filter(Boolean));
   let slug=base,n=2;while(used.has(slug.toLowerCase()))slug=`${base}-${n++}`;
   const {data,error:e}=await supabase.from('categories').update({name,slug,is_active:categoryEditActive}).eq('id',category.id).select('id,name,slug,is_active,image_url').maybeSingle();
   if(e)throw e;
   if(!data)throw new Error('No category was updated. Check administrator update permissions.');
   setCategories(prev=>prev.map(c=>c.id===data.id?{...c,...data}:c).sort((a,b)=>a.name.localeCompare(b.name)));
   setCategoryEditId(null);setCategoryEditName('');setError(`Category “${name}” updated. Products remain assigned through their category ID.`);
  }catch(e){setError(`Category could not be updated: ${e?.message||'check category-table update permissions.'}`);}
  finally{setCategorySaving(false);}
 }
 function beginCategoryEdit(category){setCategoryEditId(category.id);setCategoryEditName(category.name||'');setCategoryEditActive(category.is_active!==false);setError('');}
 async function deleteCategory(category){
  if(!category?.id){setError('Cannot delete this category because its ID is missing.');return;}
  const confirmMessage=`Delete category “${category.name}”? This is only allowed when no products are assigned to it.`;
  if(Platform.OS==='web'){
   let confirmed=true;try{if(typeof window!=='undefined'&&typeof window.confirm==='function')confirmed=window.confirm(confirmMessage);}catch(_){confirmed=false;}
   if(!confirmed)return;
   await deleteCategoryConfirmed(category);return;
  }
  Alert.alert('Delete category',confirmMessage,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteCategoryConfirmed(category)}]);
 }
 async function deleteCategoryConfirmed(category){
  setCategorySaving(true);setError('');
  try{
   const {data:assigned,error:assignedError}=await supabase.from('products').select('id').eq('category_id',category.id).limit(1);
   if(assignedError)throw assignedError;
   const {data:linked,error:linkedError}=await supabase.from('product_categories').select('product_id').eq('category_id',category.id).limit(1);
   if(linkedError)throw linkedError;
   if(assigned?.length||linked?.length){setError(`Cannot delete “${category.name}” because products are assigned to it. Reassign those products first, then try again.`);return;}
   const {data,error:e}=await supabase.from('categories').delete().eq('id',category.id).select('id');
   if(e)throw e;
   if(!data?.length)throw new Error('No category was deleted. Check administrator delete permissions.');
   setCategories(prev=>prev.filter(c=>c.id!==category.id));
   if(categoryEditId===category.id){setCategoryEditId(null);setCategoryEditName('');}
   setError(`Category “${category.name}” deleted.`);
  }catch(e){setError(`Category could not be deleted: ${e?.message||'check administrator permissions and product assignments.'}`);}
  finally{setCategorySaving(false);}
 }

 async function syncMenuCategories(){
  const menuCategories=menuItems.filter(m=>['category','subcategory'].includes(getMenuType(m)));
  if(!menuCategories.length){setError('No categories or subcategories exist in Menu Management yet.');return;}
  setCategorySaving(true);setError('');
  try{
   // Read the existing names/slugs first. The database may enforce a normalized
   // unique name constraint (categories_name_key), so do not assume client-side
   // state contains every row, and insert one row at a time to handle races safely.
   const {data:existingRows,error:existingError}=await supabase.from('categories').select('id,name,slug,is_active,image_url');
   if(existingError)throw existingError;
   const knownNames=new Set((existingRows||[]).map(row=>normalizeCategoryName(row.name)).filter(Boolean));
   const usedSlugs=new Set((existingRows||[]).map(row=>String(row.slug||'').trim().toLowerCase()).filter(Boolean));
   const seenNames=new Set(knownNames);
   // Also collapse repeated labels inside the menu tree before copying to the catalogue.
   // Product catalogue categories are global, so a label should map to one record. 
   const candidates=[];
   for(const item of menuCategories){
     const name=String(item.label||'').trim();
     const nameKey=normalizeCategoryName(name);
     if(!name||seenNames.has(nameKey))continue;
     seenNames.add(nameKey);
     const base=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'category';
     let slug=base,n=2;
     while(usedSlugs.has(slug.toLowerCase()))slug=`${base}-${n++}`;
     usedSlugs.add(slug.toLowerCase());
     candidates.push({name,slug,is_active:!!item.is_active});
   }
   if(!candidates.length){
     setCategories((existingRows||[]).sort((a,b)=>a.name.localeCompare(b.name)));
     setError('All menu categories and subcategories already exist in the product catalogue. Existing categories were preserved.');
     return;
   }
   let added=0,duplicates=0;
   for(const row of candidates){
     const {data,error:e}=await supabase.from('categories').insert(row).select('id,name,slug,is_active').maybeSingle();
     if(!e&&data){added++;knownNames.add(normalizeCategoryName(data.name));continue;}
     // A concurrent sync, hidden existing row, or case-insensitive unique index can
     // produce 23505. Treat that as already present; never overwrite/delete it.
     if(e?.code==='23505'||/duplicate key|unique constraint/i.test(String(e?.message||''))){duplicates++;continue;}
     throw e;
   }
   const {data:refreshed,error:refreshError}=await supabase.from('categories').select('id,name,slug,is_active,image_url').order('name');
   if(refreshError)throw refreshError;
   setCategories(refreshed||[]);
   setError(`${added} category record(s) added${duplicates?`; ${duplicates} already existed and were skipped`:''}. Existing categories and product assignments were preserved.`);
  }catch(e){setError(`Could not sync categories: ${e?.message||'check category-table permissions and required columns.'}`);}
  finally{setCategorySaving(false);}
 }

 async function saveProduct(){
  if(!productForm.name.trim()||!productForm.price_zmw){setError('Product name and price are required.');return;}
  if(Number(productForm.price_zmw)<0||!Number.isFinite(Number(productForm.price_zmw))){setError('Enter a valid non-negative price in ZMW.');return;}
  const selectedCategoryIds=Array.from(new Set([...(productForm.category_ids||[]),productForm.category_id].filter(Boolean)));
  if(!selectedCategoryIds.length){setError('Choose at least one product category before saving.');return;}
  setBusy(true);setError('');
  try{
   const scheduledAt=String(productForm.scheduled_at||'').trim();
   if(scheduledAt && (Number.isNaN(Date.parse(scheduledAt)) || Date.parse(scheduledAt)<=Date.now())){setError('Choose a future publication date and time, e.g. 2026-10-27T09:00:00+02:00.');setBusy(false);return;}
   const isScheduled=!!scheduledAt;
   // Generate a unique slug before writing. Keep an existing product's slug when
   // available, but never allow another product to claim the same slug.
   const slugBase=String(productForm.slug||productForm.name||'product').toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'product';
   const {data:slugRows,error:slugRowsError}=await supabase.from('products').select('id,slug');
   if(slugRowsError)throw new Error(`Could not check product slugs: ${slugRowsError.message}`);
   const usedSlugs=new Set((slugRows||[]).filter(item=>item.id!==productForm.id).map(item=>String(item.slug||'').trim().toLowerCase()).filter(Boolean));
   let uniqueSlug=slugBase,slugSuffix=2;
   while(usedSlugs.has(uniqueSlug.toLowerCase()))uniqueSlug=`${slugBase}-${slugSuffix++}`;
   const row={name:productForm.name.trim(),slug:uniqueSlug,summary:(productForm.summary||'').trim()||null,description:(productForm.description||'').trim()||null,brand:(productForm.brand||'').trim()||null,sku:(productForm.sku||'').trim()||null,image_url:(productForm.image_url||'').trim()||null,category_id:productForm.category_id||selectedCategoryIds[0],price_zmw:Number(productForm.price_zmw),original_price_zmw:productForm.original_price_zmw&&Number(productForm.original_price_zmw)>Number(productForm.price_zmw)?Number(productForm.original_price_zmw):null,rating:Math.min(5,Math.max(0,Number(productForm.rating||5))),stock_quantity:Math.max(0,Math.floor(Number(productForm.stock_quantity||0))),low_stock_threshold:Math.max(0,Math.floor(Number(productForm.low_stock_threshold||0))),expiry_date:String(productForm.expiry_date||'').trim()||null,is_active:isScheduled?false:(productForm.id?!!productForm.is_active:true),requires_prescription:!!productForm.requires_prescription,scheduled_at:isScheduled?new Date(Date.parse(scheduledAt)).toISOString():null,updated_at:new Date().toISOString()};
   // image_urls is optional until the product gallery migration is applied.
   // Existing single-image upload remains fully functional without that column.
   const galleryImages=Array.from(new Set([...(productForm.image_urls||[]),productForm.image_url].filter(Boolean)));
   row.image_url=galleryImages[0]||row.image_url;
   let savedProductId=productForm.id;
   if(productForm.id){
    const result=await supabase.from('products').update(row).eq('id',productForm.id);
    if(result.error)throw result.error;
   }else{
    // A concurrent save can claim the slug after the pre-check. Retry with a
    // numbered suffix if the database reports the slug unique constraint.
    let result=null;
    for(let attempt=0;attempt<6;attempt++){
     result=await supabase.from('products').insert(row).select('id').single();
     if(!result.error)break;
     const isSlugCollision=result.error.code==='23505'&&(/products_slug_key/i.test(result.error.message||'')||/slug/i.test(result.error.details||''));
     if(!isSlugCollision||attempt===5)throw result.error;
     const {data:latestSlugs,error:latestSlugError}=await supabase.from('products').select('slug');
     if(latestSlugError)throw latestSlugError;
     const latestUsed=new Set((latestSlugs||[]).map(item=>String(item.slug||'').trim().toLowerCase()));
     do{row.slug=`${slugBase}-${slugSuffix++}`;}while(latestUsed.has(row.slug.toLowerCase()));
    }
    savedProductId=result.data.id;
   }
   const {error:clearLinksError}=await supabase.from('product_categories').delete().eq('product_id',savedProductId);
   if(clearLinksError)throw new Error(`Product saved, but existing category links could not be updated. Run the product_categories migration and check admin permissions: ${clearLinksError.message}`);
   const links=selectedCategoryIds.map(category_id=>({product_id:savedProductId,category_id}));
   const {error:linkError}=await supabase.from('product_categories').insert(links);
   if(linkError)throw new Error(`Product saved, but category assignments failed. Check product_categories permissions: ${linkError.message}`);
   setProductForm({...emptyProductForm});
   await loadData();setError(productForm.id?'Product updated successfully.':'Product added successfully.');
  }catch(e){setError(`Product could not be saved: ${e?.message||'check product fields, category selection and administrator permissions.'}`);}
  finally{setBusy(false);}
 }
 async function adjustInventoryStock(p, delta){
  if(!p?.id)return;
  const current=Math.max(0,Number(p.stock_quantity||0));
  const next=current+delta;
  if(next<0){setError('Stock cannot be reduced below zero.');return;}
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.from('products').update({stock_quantity:next,updated_at:new Date().toISOString()}).eq('id',p.id).select('id,stock_quantity').maybeSingle();
   if(e)throw e;
   if(!data)throw new Error('No stock record was updated. Check administrator update permissions.');
   setProducts(prev=>prev.map(item=>item.id===p.id?{...item,stock_quantity:Number(data.stock_quantity)}:item));
   setError(`Stock updated for ${p.name}: ${data.stock_quantity} units.`);
  }catch(e){setError(`Stock could not be updated: ${e?.message||'check administrator permissions and try again.'}`);}
  finally{setBusy(false);}
 }
 function editInventoryProduct(p){
  setProductForm({...emptyProductForm,id:p.id,name:p.name||'',slug:p.slug||'',summary:p.summary||'',description:p.description||'',price_zmw:String(p.price_zmw??''),original_price_zmw:String(p.original_price_zmw??''),rating:String(p.rating??5),stock_quantity:String(p.stock_quantity??0),low_stock_threshold:String(p.low_stock_threshold??5),expiry_date:p.expiry_date||'',brand:p.brand||'',sku:p.sku||'',image_url:p.image_url||'',image_urls:Array.isArray(p.image_urls)&&p.image_urls.length?p.image_urls:(p.image_url?[p.image_url]:[]),category_id:p.category_id||'',category_ids:p.category_ids?.length?p.category_ids:(p.category_id?[p.category_id]:[]),is_active:!!p.is_active,requires_prescription:!!p.requires_prescription,scheduled_at:p.scheduled_at||''});
  setPage('Products');setSearch('');setError(`Editing ${p.name}. Update the fields and save your changes.`);
 }
 async function toggleProductPause(p){
  if(!p?.id){setError('Cannot change this product because its ID is missing.');return;}
  const nextActive=!p.is_active;setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.from('products').update({is_active:nextActive,scheduled_at:null}).eq('id',p.id).select('id,is_active').maybeSingle();
   if(e)throw e;
   if(!data)throw new Error('No product was updated. Check that you are signed in as an administrator and that the products table update policy allows admin_members.');
   await loadData();setError(nextActive?'Product resumed. It is marked active; confirm the storefront read policy allows active products.':'Product paused and hidden from the customer catalogue.');
  }catch(e){setError(`Could not ${nextActive?'resume':'pause'} product: ${e?.message||'database update failed.'}`);}
  finally{setBusy(false);}
 }
 async function deleteProduct(p){
  if(!p?.id){setError('Cannot delete this product because its ID is missing.');return;}
  // React Native Alert.alert is not consistently rendered on web, so use browser confirmation there.
  if(Platform.OS==='web'){
   let confirmed=true;
   try{if(typeof window!=='undefined' && typeof window.confirm==='function')confirmed=window.confirm(`Permanently delete “${p.name}”? This cannot be undone.`);}catch(_){confirmed=false;}
   if(!confirmed)return;
   await deleteProductConfirmed(p);return;
  }
  Alert.alert('Delete product',`Permanently delete “${p.name}”? This cannot be undone.`,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteProductConfirmed(p)}]);
 }
 async function deleteProductConfirmed(p){
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.from('products').delete().eq('id',p.id).select('id');
   if(e)throw e;
   if(!data?.length)throw new Error('No product was deleted. Check administrator delete permissions. If this product is referenced by an order, pause it instead of deleting it.');
   setProductForm(prev=>prev.id===p.id?{...emptyProductForm}:prev);await loadData();setError(`Product “${p.name}” deleted.`);
  }catch(e){setError(`Could not delete product: ${e?.message||'check administrator permissions or existing order references. Products already used in orders should be paused instead.'}`);}
  finally{setBusy(false);}
 }
 function scheduleProduct(p){
  if(!p?.id){setError('Cannot schedule this product because its ID is missing.');return;}
  if(Platform.OS==='web' && typeof window!=='undefined' && typeof window.prompt==='function'){
   const date=window.prompt('Enter future publication date/time including timezone, e.g. 2026-10-27T09:00:00+02:00',p.scheduled_at||'');
   if(date===null)return;
   if(!date.trim()||Number.isNaN(Date.parse(date))||Date.parse(date)<=Date.now()){setError('Enter a valid future date and time including timezone, e.g. 2026-10-27T09:00:00+02:00.');return;}
   saveProductSchedule(p,new Date(Date.parse(date)).toISOString());
   return;
  }
  setProductForm({...emptyProductForm,id:p.id,name:p.name||'',slug:p.slug||'',description:p.description||'',price_zmw:String(p.price_zmw??''),stock_quantity:String(p.stock_quantity??0),low_stock_threshold:String(p.low_stock_threshold??5),expiry_date:p.expiry_date||'',brand:p.brand||'',sku:p.sku||'',image_url:p.image_url||'',category_id:p.category_id||'',is_active:false,requires_prescription:!!p.requires_prescription,scheduled_at:p.scheduled_at||''});
  setError('Enter a future publication date/time in the product form, then press Update product.');
 }
 async function saveProductSchedule(p,scheduledAt){
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.from('products').update({is_active:false,scheduled_at:scheduledAt}).eq('id',p.id).select('id,scheduled_at').maybeSingle();
   if(e)throw e;
   if(!data)throw new Error('No product was updated. Check administrator update permissions.');
   await loadData();setError(`Schedule saved for ${new Date(scheduledAt).toLocaleString()}. Automatic publication at that time requires the scheduled-publishing database job to be enabled.`);
  }catch(e){setError(`Could not schedule product: ${e?.message||'database update failed. Ensure the scheduled_at column exists and administrator update permissions are enabled.'}`);}
  finally{setBusy(false);}
 }
 async function saveMenuItem(){
  if(!menuForm.label.trim()){setError('Enter a menu label before saving.');return;}
  const type=menuForm.node_type||'menu';
  const parent=menuItems.find(m=>m.id===menuForm.parent_id);
  const inferredType=item=>{
   if(!item)return null;
   if(item.node_type && ['menu','category','subcategory'].includes(item.node_type))return item.node_type;
   if(!item.parent_id)return 'menu';
   const p=menuItems.find(m=>m.id===item.parent_id);
   return !p?'invalid':(p.node_type==='menu'||!p.parent_id?'category':'subcategory');
  };
  if(type==='menu' && menuForm.parent_id){setError('A main menu must not have a parent.');return;}
  if(type==='category' && (!parent || inferredType(parent)!=='menu')){setError('A category must be placed directly under a main menu.');return;}
  if(type==='subcategory' && (!parent || inferredType(parent)!=='category')){setError('A subcategory must be placed directly under a category.');return;}
  if(menuForm.parent_id && menuForm.id===menuForm.parent_id){setError('A menu item cannot be its own parent.');return;}
  const labelKey=normalizeCategoryName(menuForm.label);
  const duplicateSibling=menuItems.some(item=>item.id!==menuForm.id && (item.parent_id||null)===(menuForm.parent_id||null) && inferredType(item)===type && normalizeCategoryName(item.label)===labelKey);
  if(duplicateSibling){setError('An item with this name already exists at this level. Rename it or edit the existing item to avoid duplicate menu entries.');return;}
  setBusy(true);setError('');
  try{
   const row={label:menuForm.label.trim(),node_type:type,slug:menuForm.label.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+(menuForm.id||Date.now()),parent_id:menuForm.parent_id||null,sort_order:Number(menuForm.sort_order||0),is_active:!!menuForm.is_active,destination_type:menuForm.destination_type||'category',destination_value:(menuForm.destination_value||'').trim()||null,updated_at:new Date().toISOString()};
   if(menuForm.id)row.id=menuForm.id;
   const {error:e}=await supabase.from('store_menu_items').upsert(row);
   if(e)throw e;
   setMenuForm({id:null,label:'',node_type:'menu',parent_id:'',sort_order:String((menuItems.length+1)*10),is_active:true,destination_type:'category',destination_value:''});
   await loadData();setError('Menu item saved successfully.');
  }catch(e){setError(`Menu item could not be saved: ${e.message||'check the menu table migration and administrator permissions.'}`);}
  finally{setBusy(false);}
 }
 async function deleteMenuItem(item){if(menuItems.some(m=>m.parent_id===item.id)){setError('Move or delete this item’s submenus first.');return;}try{const {error:e}=await supabase.from('store_menu_items').delete().eq('id',item.id);if(e)throw e;await loadData();if(menuForm.id===item.id)setMenuForm({id:null,label:'',node_type:'menu',parent_id:'',sort_order:'0',is_active:true,destination_type:'category',destination_value:''});setError('Menu item deleted.');}catch(e){setError(`Menu item could not be deleted: ${e.message||'please try again.'}`);}}
 function menuTreeRows(parentId=null,depth=0){return menuItems.filter(m=>(m.parent_id||null)===parentId).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).flatMap(item=>[{...item,_depth:depth},...menuTreeRows(item.id,depth+1)]);}
 async function saveBranding(){setBrandingSaving(true);setError('');try{const payload={...branding,id:'default',updated_at:new Date().toISOString(),updated_by:session.user.id};const {error:e}=await supabase.from('app_login_branding').upsert(payload,{onConflict:'id'});if(e)throw e;homepageSelectionDirty.current=false;setError(page==='Homepage Categories'?'Homepage category selection saved. Refresh the storefront to see the selected sections.':'Login and registration branding saved. Refresh the storefront to see changes.');}catch(e){setError(`Your branding changes could not be saved: ${e?.message||'check your administrator permissions and database migration.'}`);}finally{setBrandingSaving(false);}}
 async function chooseBrandImage(field,label){try{setError('');const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){setError('Allow photo-library access to choose a branding image.');return;}const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,quality:0.78});if(result.canceled||!result.assets?.[0])return;const asset=result.assets[0];const ext=(asset.fileName?.split('.').pop()||asset.mimeType?.split('/').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${field}/${session.user.id}-${Date.now()}.${ext}`;setBrandingSaving(true);const response=await fetch(asset.uri);const blob=await response.blob();const {error:uploadError}=await supabase.storage.from('login-branding').upload(path,blob,{upsert:true,contentType:asset.mimeType||'image/jpeg',cacheControl:'31536000'});if(uploadError)throw uploadError;const {data}=supabase.storage.from('login-branding').getPublicUrl(path);
const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
const nextBranding = { ...branding, [field]: publicUrl, id: 'default', updated_at: new Date().toISOString(), updated_by: session.user.id };
// Persist the selected logo immediately so it survives refresh even if Save is overlooked.
const { error: persistError } = await supabase.from('app_login_branding').upsert(nextBranding, { onConflict: 'id' });
if (persistError) throw persistError;
setBranding(nextBranding);
setError(`${label} uploaded and saved. It will remain selected after refresh.`);}catch(e){setError('The image could not be uploaded. Please check your connection and image permissions, then try again.');}finally{setBrandingSaving(false);}}
 async function chooseBannerImage() {
  try {
   setError('');
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!permission.granted){setError('Allow photo-library access to choose banner images.');return;}
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,allowsMultipleSelection:true,selectionLimit:10,quality:0.78});
   if(result.canceled||!result.assets?.length)return;
   const assets=result.assets;
   for(const asset of assets){
    const mime=asset.mimeType||'image/jpeg';
    const ext=(asset.fileName?.split('.').pop()||mime.split('/').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    if(!['jpg','jpeg','png','webp'].includes(ext))throw new Error('Choose JPG, PNG or WebP images only.');
    if(asset.fileSize&&asset.fileSize>8*1024*1024)throw new Error('Each banner image must be smaller than 8 MB.');
   }
   setBannerImageBusy(true);
   const uploaded=[];
   for(let i=0;i<assets.length;i++){
    const asset=assets[i], mime=asset.mimeType||'image/jpeg';
    const ext=(asset.fileName?.split('.').pop()||mime.split('/').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const response=await fetch(asset.uri);const blob=await response.blob();
    const path=`${session.user.id}/${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}.${ext}`;
    const {error:uploadError}=await supabase.storage.from('store-banners').upload(path,blob,{upsert:false,contentType:mime,cacheControl:'31536000'});
    if(uploadError)throw uploadError;
    const {data}=supabase.storage.from('store-banners').getPublicUrl(path);
    uploaded.push(`${data.publicUrl}?v=${Date.now()}`);
   }
   setBannerForm(prev=>{const combined=[...(Array.isArray(prev.image_urls)?prev.image_urls:[]),...uploaded];return {...prev,image_urls:combined,image_url:combined[0]||''};});
   setError(`${uploaded.length} image${uploaded.length===1?'':'s'} uploaded. ${uploaded.length===1?'This banner will remain static. Add more images to enable its slideshow.':'This banner will run its own slideshow.'} Save the banner to publish the changes.`);
  }catch(e){setError(`Banner image upload failed: ${e?.message||'check the store-banners storage bucket and permissions.'}`);}
  finally{setBannerImageBusy(false);}
 }
 function removeBannerImage(url){setBannerForm(prev=>{const images=(Array.isArray(prev.image_urls)?prev.image_urls:[]).filter(x=>x!==url);return {...prev,image_urls:images,image_url:images[0]||''};});}
 function moveBannerImage(index,delta){setBannerForm(prev=>{const images=[...(Array.isArray(prev.image_urls)?prev.image_urls:[])];const next=index+delta;if(next<0||next>=images.length)return prev;[images[index],images[next]]=[images[next],images[index]];return {...prev,image_urls:images,image_url:images[0]||''};});}
 async function saveBanner(){
   const title=String(bannerForm.title||'').trim();
   if(!title){setError('Enter a banner heading before saving.');return;}
   const parseOptionalDate=(value,label)=>{const raw=String(value||'').trim();if(!raw)return null;const ms=Date.parse(raw);if(!Number.isFinite(ms))throw new Error(`${label} is not a valid date/time. Use a format such as 2026-10-28T08:00:00+02:00, or leave it blank.`);return new Date(ms).toISOString();};
   let startsAt,endsAt;
   try{startsAt=parseOptionalDate(bannerForm.starts_at,'Start date/time');endsAt=parseOptionalDate(bannerForm.ends_at,'End date/time');if(startsAt&&endsAt&&Date.parse(startsAt)>=Date.parse(endsAt))throw new Error('The end date/time must be later than the start date/time.');}catch(validationError){setError(validationError.message);return;}
   if(!session?.user?.id){setError('Your administrator session has expired. Sign in again, then retry saving the banner.');return;}
   setBannerSaving(true);setError('');
   try{
    const imageUrls=Array.isArray(bannerForm.image_urls)?bannerForm.image_urls.filter(Boolean):(bannerForm.image_url?[bannerForm.image_url]:[]);
    const payload={name:String(bannerForm.name||'').trim()||title,placement:bannerForm.placement||'hero',eyebrow:String(bannerForm.eyebrow||'').trim()||null,title,description:String(bannerForm.description||'').trim()||null,button_text:String(bannerForm.button_text||'').trim()||null,link_url:String(bannerForm.link_url||'').trim()||null,image_url:imageUrls[0]||bannerForm.image_url||null,image_urls:imageUrls,slideshow_type:'automatic',slideshow_effect:bannerForm.slideshow_effect||'slide-left',image_size:'placement',image_fit:bannerForm.image_fit||'cover',mobile_image_url:bannerForm.mobile_image_url||null,background_color:bannerForm.background_color||'#0B4B38',text_color:bannerForm.text_color||'#FFFFFF',eyebrow_color:bannerForm.eyebrow_color||'#C8F36A',button_color:bannerForm.button_color||'#C8F36A',sort_order:Number(bannerForm.sort_order)||0,is_active:!!bannerForm.is_active,starts_at:startsAt,ends_at:endsAt,updated_at:new Date().toISOString(),updated_by:session.user.id};
    let result;
    if(bannerForm.id)result=await supabase.from('store_banners').update(payload).eq('id',bannerForm.id).select('*').maybeSingle();
    else result=await supabase.from('store_banners').insert({...payload,created_by:session.user.id}).select('*').single();
    if(result.error)throw result.error;
    if(!result.data)throw new Error('No banner record was updated. Check the store_banners UPDATE Row Level Security policy for administrator access.');
    await refreshBanners();setBannerForm({...emptyBannerForm});setError(bannerForm.id?'Banner updated successfully. Your changes have been saved.':'Banner created successfully. Active banners will appear on the storefront after refresh.');
   }catch(e){const message=String(e?.message||e||'Unknown database error');const hint=/column .* does not exist|schema cache|could not find the .* column/i.test(message)?' The store_banners table may be missing a field used by banner settings; apply the latest banner SQL migration.':/row-level security|permission denied|not allowed/i.test(message)?' Check the store_banners INSERT/UPDATE Row Level Security policies for admin_members.':'';setError(`Banner could not be ${bannerForm.id?'updated':'saved'}: ${message}.${hint}`);}
   finally{setBannerSaving(false);}
  }
  async function refreshBanners(){const {data,error:e}=await supabase.from('store_banners').select('*').order('sort_order');if(e)throw e;setBanners(data||[]);}
 async function deleteBanner(id){try{const {error:e}=await supabase.from('store_banners').delete().eq('id',id);if(e)throw e;setBanners(prev=>prev.filter(x=>x.id!==id));if(bannerForm.id===id)setBannerForm(emptyBannerForm);setError('Banner deleted.');}catch(e){setError(`Banner could not be deleted: ${e?.message||'check administrator permissions.'}`);}}
 async function toggleBanner(banner){try{const {data,error:e}=await supabase.from('store_banners').update({is_active:!banner.is_active,updated_at:new Date().toISOString(),updated_by:session.user.id}).eq('id',banner.id).select('*').single();if(e)throw e;setBanners(prev=>prev.map(x=>x.id===banner.id?data:x));setError(data.is_active?'Banner published.':'Banner unpublished.');}catch(e){setError(`Banner status could not be changed: ${e?.message||'check permissions.'}`);}}
 function BrandImageControl({label,field}){const url=branding[field];return <View style={{gap:8,marginBottom:15}}><Text style={s.label}>{label}</Text><View style={{flexDirection:'row',alignItems:'center',gap:12,flexWrap:'wrap'}}>{url?<Image source={{uri:url}} resizeMode="contain" style={{width:110,height:74,borderRadius:10,borderWidth:1,borderColor:LINE,backgroundColor:'#F8FBF9'}}/>:<View style={{width:110,height:74,borderRadius:10,borderWidth:1,borderColor:LINE,backgroundColor:'#F4F8F5',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={26} color={MUTED}/><Text style={{fontSize:10,color:MUTED}}>No image</Text></View>}<View style={{gap:7,flex:1,minWidth:170}}><Btn outline onPress={()=>chooseBrandImage(field,label)} disabled={brandingSaving}>Choose from device</Btn>{url?<Btn outline onPress={()=>setBranding(prev=>({...prev,[field]:''}))}>Remove image</Btn>:null}<Text style={s.muted}>PNG, JPG or WebP. Images are saved to Kanev Pharmacy storage.</Text></View></View></View>}
 async function toggleOrderItems(orderId){
  if(expandedOrderId===orderId){setExpandedOrderId(null);return;}
  setExpandedOrderId(orderId);
  if(orderItemsById[orderId])return;
  setOrderItemsLoadingId(orderId);
  try{
    const {data,error:e}=await supabase.from('order_items').select('id,product_id,product_name_snapshot,unit_price_zmw,quantity,line_total_zmw').eq('order_id',orderId).order('created_at',{ascending:true});
    if(e)throw e;setOrderItemsById(prev=>({...prev,[orderId]:data||[]}));
  }catch(e){setError(`Order items could not be loaded: ${e?.message||'check order_items read permissions.'}`);setOrderItemsById(prev=>({...prev,[orderId]:[]}));}
  finally{setOrderItemsLoadingId(null);}
 }
 const ORDER_STEPS=[
  {status:'confirmed',label:'Confirmed'},
  {status:'preparing',label:'Preparing'},
  {status:'ready_for_collection',label:'Ready'},
  {status:'out_for_delivery',label:'Out for delivery'},
  {status:'completed',label:'Completed'},
 ];
 const terminalOrderStatus=(status)=>['completed','cancelled'].includes(String(status||'').toLowerCase());
 const orderStatusLabel=(status)=>({pending_review:'Pending',confirmed:'Confirmed',preparing:'Preparing',ready_for_collection:'Ready',out_for_delivery:'Out for delivery',completed:'Completed',cancelled:'Cancelled'})[String(status||'').toLowerCase()]||String(status||'Pending').replaceAll('_',' ');
 const allowedNextOrderStatuses=(order)=>{
  const status=String(order?.status||'pending_review').toLowerCase();
  if(terminalOrderStatus(status))return [];
  if(status==='pending_review')return ['confirmed','cancelled'];
  if(status==='confirmed')return ['preparing','cancelled'];
  if(status==='preparing')return ['ready_for_collection','cancelled'];
  if(status==='ready_for_collection')return order?.fulfilment==='delivery'?['out_for_delivery','cancelled']:['completed','cancelled'];
  if(status==='out_for_delivery')return ['completed','cancelled'];
  return ['cancelled'];
 };
 async function updateOrder(id,status){
  const current=orders.find(o=>o.id===id);if(!current)return;
  const currentStatus=String(current.status||'pending_review').toLowerCase();
  if(terminalOrderStatus(currentStatus)){setError('This order is already final and cannot be changed.');return;}
  if(!allowedNextOrderStatuses(current).includes(status)){setError('Please follow the order steps in sequence.');return;}
  setLoading(true);setError('');
  try{
    const now=new Date().toISOString();
    const patch={status,updated_at:now};
    if(status==='completed'){patch.delivery_status='delivered';patch.delivered_at=now;}
    if(status==='out_for_delivery'){patch.delivery_status='out_for_delivery';patch.dispatched_at=now;}
    if(status==='ready_for_collection')patch.delivery_status='ready';
    if(status==='cancelled')patch.delivery_status='cancelled';
    const {data,error:e}=await supabase.from('orders').update(patch).eq('id',id).select('id,status').maybeSingle();
    if(e)throw e;if(!data)throw new Error('No order was updated. Check administrator permissions.');
    // Keep the customer-facing timeline concise: one short tracking event per successful transition.
    const shortLabel=orderStatusLabel(status);
    const {error:trackingError}=await supabase.from('order_tracking_events').insert({order_id:id,status,message:`Order ${shortLabel.toLowerCase()}.`,actor_id:session?.user?.id||null});
    if(trackingError)console.warn('Order tracking event could not be saved:',trackingError.message);
    await loadData();setError(`Order ${current.order_number||id.slice(0,8)}: ${shortLabel}.`);
  }catch(e){setError(`Order status could not be updated: ${e?.message||'check order status values and administrator permissions.'}`);}finally{setLoading(false);}
}
 const filteredOrders=useMemo(()=>orders.filter(o=>`${o.order_number||''} ${o.customer_name||''} ${o.customer_phone||''} ${o.status||''}`.toLowerCase().includes(search.toLowerCase())),[orders,search]);
 const filteredProducts=useMemo(()=>products.filter(o=>`${o.name||''} ${o.slug||''}`.toLowerCase().includes(search.toLowerCase())),[products,search]);
 // Keep product assignment aligned with Menu Management's actual three-level tree.
 // Subcategories stay in the database for product.category_id, but are only shown
 // after their parent category is selected rather than as top-level choices.
 const normalizeCategoryName=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
 const getMenuType=item=>{if(item?.node_type)return item.node_type;if(!item?.parent_id)return 'menu';const parent=menuItems.find(x=>x.id===item.parent_id);return parent?.parent_id?'subcategory':'category';};
 const menuCategoryItems=menuItems.filter(item=>getMenuType(item)==='category');
 const menuSubcategoryItems=menuItems.filter(item=>getMenuType(item)==='subcategory');
 const subcategoryNameSet=new Set(menuSubcategoryItems.map(item=>normalizeCategoryName(item.label)));
 const productParentCategories=categories.filter(category=>!subcategoryNameSet.has(normalizeCategoryName(category.name)));
 const selectedCategoryRecord=categories.find(category=>category.id===productForm.category_id)||null;
 const selectedCategoryMenuItem=selectedCategoryRecord?menuItems.find(item=>['category','subcategory'].includes(getMenuType(item))&&normalizeCategoryName(item.label)===normalizeCategoryName(selectedCategoryRecord.name)):null;
 const selectedProductMenuParent=selectedCategoryMenuItem?(getMenuType(selectedCategoryMenuItem)==='subcategory'?menuItems.find(item=>item.id===selectedCategoryMenuItem.parent_id):selectedCategoryMenuItem):null;
 const visibleProductSubcategories=selectedProductMenuParent?menuSubcategoryItems.filter(item=>item.parent_id===selectedProductMenuParent.id).map(item=>({menuItem:item,category:categories.find(category=>normalizeCategoryName(category.name)===normalizeCategoryName(item.label))})):[];
 const toggleProductCategory=categoryId=>setProductForm(prev=>{
  // Merge the legacy primary category into the list before toggling so it can
  // be removed just like every other selected category.
  const ids=new Set([...(prev.category_ids||[]),prev.category_id].filter(Boolean));
  if(ids.has(categoryId))ids.delete(categoryId);else ids.add(categoryId);
  const next=[...ids];
  const primary=next.includes(prev.category_id)?prev.category_id:(next.find(id=>productParentCategories.some(c=>c.id===id))||next[0]||'');
  return {...prev,category_ids:next,category_id:primary};
 });
 const toggleProductParentWithChildren=(category,childIds=[])=>setProductForm(prev=>{
  const ids=new Set([...(prev.category_ids||[]),prev.category_id].filter(Boolean));
  if(ids.has(category.id)){ids.delete(category.id);childIds.forEach(id=>ids.delete(id));}
  else ids.add(category.id);
  const next=[...ids];
  const primary=next.includes(prev.category_id)?prev.category_id:(next.find(id=>productParentCategories.some(c=>c.id===id))||next[0]||'');
  return {...prev,category_ids:next,category_id:primary};
 });
 const toggleProductSubcategoryForParent=(categoryId,parentCategoryId)=>setProductForm(prev=>{
  const ids=new Set([...(prev.category_ids||[]),prev.category_id].filter(Boolean));
  if(ids.has(categoryId))ids.delete(categoryId);
  else {ids.add(parentCategoryId);ids.add(categoryId);}
  const next=[...ids];
  const primary=next.includes(prev.category_id)?prev.category_id:(next.find(id=>productParentCategories.some(c=>c.id===id))||next[0]||'');
  return {...prev,category_ids:next,category_id:primary};
 });
 const assignProductCategory=categoryId=>setProductForm(prev=>{
  const ids=new Set([...(prev.category_ids||[]),prev.category_id].filter(Boolean));
  ids.add(categoryId);
  const next=[...ids];
  return {...prev,category_ids:next,category_id:prev.category_id||categoryId};
 });
 const selectProductParentCategory=category=>toggleProductCategory(category.id);
 const selectProductSubcategory=async(menuItem,category,parentCategoryId=null)=>{
  setError('');
  if(category){toggleProductSubcategoryForParent(category.id,parentCategoryId||category.id);return;}
  // A subcategory can exist in Menu Management before its product-catalogue
  // record exists. Create only that missing record on demand, then select it;
  // do not force the admin to leave the product form and run a separate sync.
  const name=String(menuItem?.label||'').trim();
  if(!name){setError('This subcategory has no name. Please check Menu Management.');return;}
  setCategorySaving(true);
  try{
   const {data:rows,error:readError}=await supabase.from('categories').select('id,name,slug,is_active,image_url');
   if(readError)throw readError;
   const match=(rows||[]).find(row=>normalizeCategoryName(row.name)===normalizeCategoryName(name));
   if(match){setCategories(rows||[]);setProductForm(prev=>({...prev,category_id:prev.category_id||parentCategoryId||match.id,category_ids:Array.from(new Set([...(prev.category_ids||[]),...(parentCategoryId?[parentCategoryId]:[]),match.id]))}));setError('');return;}
   const base=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'category';
   const used=new Set((rows||[]).map(row=>String(row.slug||'').trim().toLowerCase()).filter(Boolean));
   let slug=base,n=2;while(used.has(slug.toLowerCase()))slug=`${base}-${n++}`;
   const {data:created,error:createError}=await supabase.from('categories').insert({name,slug,is_active:menuItem.is_active!==false,image_url:null}).select('id,name,slug,is_active,image_url').single();
   if(createError){
    // If another admin created it at the same time, reload and select that row.
    if(createError.code==='23505'||/duplicate key|unique constraint/i.test(String(createError.message||''))){
     const {data:latest,error:latestError}=await supabase.from('categories').select('id,name,slug,is_active,image_url');
     if(latestError)throw latestError;
     const existing=(latest||[]).find(row=>normalizeCategoryName(row.name)===normalizeCategoryName(name));
     if(existing){setCategories(latest||[]);setProductForm(prev=>({...prev,category_id:prev.category_id||parentCategoryId||existing.id,category_ids:Array.from(new Set([...(prev.category_ids||[]),...(parentCategoryId?[parentCategoryId]:[]),existing.id]))}));setError('');return;}
    }
    throw createError;
   }
   setCategories(prev=>[...prev,created].sort((a,b)=>a.name.localeCompare(b.name)));
   setProductForm(prev=>({...prev,category_id:prev.category_id||parentCategoryId||created.id,category_ids:Array.from(new Set([...(prev.category_ids||[]),...(parentCategoryId?[parentCategoryId]:[]),created.id]))}));
   setError(`Subcategory “${name}” is ready and selected. You can add its image from Categories if needed.`);
  }catch(e){setError(`Could not prepare subcategory “${name}”: ${e?.message||'check category-table permissions.'}`);}
  finally{setCategorySaving(false);}
 };
 if(checking)return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={GREEN}/><Text style={s.muted}>Verifying secure admin access…</Text></SafeAreaView>;
 if(!session||!role)return <SafeAreaView style={s.loginWrap}><View style={s.loginCard}><View style={s.brandIcon}><Ionicons name="leaf" color={LIME} size={28}/></View><Text style={s.eyebrow}>KANEV PHARMACY</Text><Text style={s.loginTitle}>Admin portal</Text><Text style={s.muted}>Manage orders, products, stock and pharmacy operations.</Text><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address"/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry/><Btn onPress={signIn} disabled={busy}>{busy?'Signing in…':'Sign in securely'}</Btn><Text style={[s.muted,{marginTop:14,fontSize:12}]}>Administrator access only. Customer accounts cannot access this portal.</Text></View><KanevNoticeModal visible={!!error} title="Sign-in needs attention" message={error} tone="error" onClose={()=>setError('')}/></SafeAreaView>;
 const content=()=>{
 if(page==='Banners')return <><PageHeader title="Banners & promotions" subtitle="Create and manage homepage hero banners, deal tiles and promotional content." onRefresh={refreshBanners} loading={loading}/><View style={s.notice}><Ionicons name="images-outline" size={22} color={GREEN}/><View style={{flex:1}}><Text style={s.rowTitle}>Storefront placements</Text><Text style={s.muted}>Hero banner replaces the main green promotion. Deal tiles replace the two cards in “Deals you'll love”. Only active banners within their schedule are shown. Article cards and care-message banners are also supported.</Text></View></View><View style={s.panel}><Text style={s.panelTitle}>{bannerForm.id?'Edit banner':'Create a banner'}</Text><Field label="Internal banner name" value={bannerForm.name} onChangeText={v=>setBannerForm(p=>({...p,name:v}))} placeholder="e.g. October wellness promotion"/><Text style={s.label}>Placement</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>{[['hero','Main promotional banner'],['hero_side','Top hero side card'],['deal_tile','Deals tile'],['category_slot_2_3','Between homepage categories 2 and 3'],['category_slot_5_6','Between homepage categories 5 and 6'],['editorial','Health article cards'],['testimonial','Care message']].map(([v,label])=><Pressable key={v} onPress={()=>setBannerForm(p=>({...p,placement:v}))} style={{paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:bannerForm.placement===v?GREEN:LINE,borderRadius:10,backgroundColor:bannerForm.placement===v?'#EAF5EE':'#fff'}}><Text style={{fontSize:12,fontWeight:'800',color:bannerForm.placement===v?GREEN:MUTED}}>{label}</Text></Pressable>)}</View><Field label="Eyebrow / small label" value={bannerForm.eyebrow} onChangeText={v=>setBannerForm(p=>({...p,eyebrow:v}))} placeholder="Kanev offers"/><Field label="Heading (required)" value={bannerForm.title} onChangeText={v=>setBannerForm(p=>({...p,title:v}))} placeholder="Care that fits your budget"/><Field label="Description" value={bannerForm.description} onChangeText={v=>setBannerForm(p=>({...p,description:v}))} placeholder="Short supporting message"/><Field label="Button text" value={bannerForm.button_text} onChangeText={v=>setBannerForm(p=>({...p,button_text:v}))} placeholder="Shop now"/><Field label="Button destination URL (optional)" value={bannerForm.link_url} onChangeText={v=>setBannerForm(p=>({...p,link_url:v}))} placeholder="https://... or leave blank for shop"/><Text style={s.label}>Slideshow transition effect</Text><Text style={[s.muted,{marginBottom:8}]}>When this banner has 2 or more images, choose how each slide enters. One image remains still automatically.</Text><View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:12}}>{[['slide-left','Slide in from left'],['slide-right','Slide in from right'],['slide-up','Slide up'],['fade','Fade smoothly'],['zoom','Zoom in'],['pop','Pop in']].map(([v,label])=><Pressable key={v} onPress={()=>setBannerForm(p=>({...p,slideshow_effect:v}))} style={{paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:bannerForm.slideshow_effect===v?GREEN:LINE,borderRadius:10,backgroundColor:bannerForm.slideshow_effect===v?'#EAF5EE':'#fff'}}><Text style={{fontSize:12,fontWeight:'800',color:bannerForm.slideshow_effect===v?GREEN:MUTED}}>{label}</Text></Pressable>)}</View><Text style={s.label}>Recommended image dimensions for this placement</Text><View style={{padding:12,backgroundColor:'#F0F8F3',borderRadius:10,borderWidth:1,borderColor:'#D5E9DC',marginBottom:12}}><Text style={{fontSize:14,fontWeight:'900',color:GREEN}}>{{hero:'1600 × 360 px (wide main promotion)',hero_side:'800 × 480 px (top-right hero card)',deal_tile:'900 × 300 px (promotional deal tile)',editorial:'900 × 220 px (health article image strip)',testimonial:'1600 × 360 px (care message banner)',category_slot_2_3:'1600 × 220 px (wide category divider banner)',category_slot_5_6:'1600 × 220 px (wide category divider banner)'}[bannerForm.placement]||'1600 × 360 px'}</Text><Text style={{fontSize:11,color:MUTED,marginTop:4}}>Use the recommended pixel size to keep artwork sharp and correctly proportioned. The storefront keeps its existing responsive banner dimensions.</Text></View><View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:12}}>{[['cover','Fill banner (crop edges)'],['contain','Show full image']].map(([v,label])=><Pressable key={v} onPress={()=>setBannerForm(p=>({...p,image_fit:v}))} style={{paddingHorizontal:11,paddingVertical:9,borderWidth:1,borderColor:bannerForm.image_fit===v?GREEN:LINE,borderRadius:9,backgroundColor:bannerForm.image_fit===v?'#EAF5EE':'#fff'}}><Text style={{fontSize:11,fontWeight:'800',color:bannerForm.image_fit===v?GREEN:MUTED}}>{label}</Text></Pressable>)}</View><Text style={s.label}>Banner images / slideshow</Text><Text style={s.muted}>Use the + tile to add images. Reorder slides with the arrows; the first image is the starting slide.</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:14}}>{(Array.isArray(bannerForm.image_urls)&&bannerForm.image_urls.length?bannerForm.image_urls:(bannerForm.image_url?[bannerForm.image_url]:[])).map((url,index,arr)=><View key={`${url}-${index}`} style={{width:145,borderWidth:1,borderColor:LINE,borderRadius:11,padding:6,gap:6,backgroundColor:'#fff'}}><Image source={{uri:url}} resizeMode={bannerForm.image_fit||'cover'} style={{width:'100%',height:82,borderRadius:7,backgroundColor:BG}}/><Text numberOfLines={1} style={s.muted}>Slide {index+1}{index===0?' · First':''}</Text><View style={{flexDirection:'row',gap:6}}><Pressable disabled={index===0} onPress={()=>moveBannerImage(index,-1)} style={{flex:1,padding:8,alignItems:'center',borderWidth:1,borderColor:LINE,borderRadius:8,opacity:index===0?0.35:1}}><Ionicons name="arrow-back" size={17} color={GREEN}/></Pressable><Pressable disabled={index===arr.length-1} onPress={()=>moveBannerImage(index,1)} style={{flex:1,padding:8,alignItems:'center',borderWidth:1,borderColor:LINE,borderRadius:8,opacity:index===arr.length-1?0.35:1}}><Ionicons name="arrow-forward" size={17} color={GREEN}/></Pressable></View><Btn outline onPress={()=>removeBannerImage(url)}>Remove</Btn></View>)}<Pressable onPress={chooseBannerImage} disabled={bannerImageBusy} style={{width:145,minHeight:166,borderWidth:1.5,borderStyle:'dashed',borderColor:'#9DBDAA',borderRadius:11,backgroundColor:'#F5FBF7',alignItems:'center',justifyContent:'center',gap:8,opacity:bannerImageBusy?0.55:1}}><View style={{width:48,height:48,borderRadius:24,backgroundColor:'#E0F2E7',alignItems:'center',justifyContent:'center'}}><Ionicons name="add" size={30} color={GREEN}/></View><Text style={{fontSize:12,fontWeight:'900',color:GREEN}}>{bannerImageBusy?'Uploading…':'Add image'}</Text><Text style={{fontSize:10,color:MUTED}}>From your device</Text></Pressable></View><Pill label={`${(Array.isArray(bannerForm.image_urls)?bannerForm.image_urls.length:(bannerForm.image_url?1:0))} image(s) selected`}/><Field label="Background colour (hex)" value={bannerForm.background_color} onChangeText={v=>setBannerForm(p=>({...p,background_color:v}))} placeholder="#0B4B38"/><Field label="Text colour (hex)" value={bannerForm.text_color} onChangeText={v=>setBannerForm(p=>({...p,text_color:v}))} placeholder="#FFFFFF"/><Field label="Eyebrow colour (hex)" value={bannerForm.eyebrow_color} onChangeText={v=>setBannerForm(p=>({...p,eyebrow_color:v}))} placeholder="#C8F36A"/><Field label="Button colour (hex)" value={bannerForm.button_color} onChangeText={v=>setBannerForm(p=>({...p,button_color:v}))} placeholder="#C8F36A"/><Field label="Display order (lower numbers first)" value={String(bannerForm.sort_order)} onChangeText={v=>setBannerForm(p=>({...p,sort_order:v}))} keyboardType="number-pad"/><Field label="Start date/time (optional ISO format)" value={bannerForm.starts_at} onChangeText={v=>setBannerForm(p=>({...p,starts_at:v}))} placeholder="2026-10-28T08:00:00+02:00"/><Field label="End date/time (optional ISO format)" value={bannerForm.ends_at} onChangeText={v=>setBannerForm(p=>({...p,ends_at:v}))} placeholder="2026-11-01T23:59:00+02:00"/><Pressable onPress={()=>setBannerForm(p=>({...p,is_active:!p.is_active}))} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8}}><Ionicons name={bannerForm.is_active?'checkbox':'square-outline'} size={22} color={GREEN}/><Text style={s.rowTitle}>{bannerForm.is_active?'Active / published':'Inactive / hidden'}</Text></Pressable><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Btn disabled={bannerSaving||bannerImageBusy} onPress={saveBanner}>{bannerSaving?'Saving…':bannerForm.id?'Update banner':'Save banner'}</Btn><Btn outline onPress={()=>setBannerForm(emptyBannerForm)}>Clear form</Btn></View></View><View style={s.panel}><View style={s.panelHead}><Text style={s.panelTitle}>Saved banners ({banners.length})</Text><Btn outline onPress={refreshBanners}>Refresh list</Btn></View>{banners.length?banners.map(item=><View key={item.id} style={[s.listRow,{alignItems:'flex-start',gap:12}]}>{(item.image_url||(Array.isArray(item.image_urls)&&item.image_urls[0]))?<Image source={{uri:(Array.isArray(item.image_urls)&&item.image_urls[0])||item.image_url}} resizeMode="cover" style={{width:100,height:72,borderRadius:9,backgroundColor:BG}}/>:<View style={{width:100,height:72,borderRadius:9,backgroundColor:item.background_color||BG,alignItems:'center',justifyContent:'center'}}><Ionicons name="images-outline" size={24} color={item.text_color||GREEN}/></View>}<View style={{flex:1,minWidth:0,gap:4}}><Text style={s.rowTitle}>{item.title}</Text><Text style={s.muted}>{({hero:'Main promotional banner',hero_side:'Top hero side card',deal_tile:'Deals tile',editorial:'Health article card',testimonial:'Care message',category_slot_2_3:'Between homepage categories 2 and 3',category_slot_5_6:'Between homepage categories 5 and 6'}[item.placement]||item.placement)} · Order {item.sort_order||0}</Text><Pill label={item.is_active?'Published':'Hidden'} danger={!item.is_active}/></View><View style={{gap:6}}><Btn outline onPress={()=>{setError('');setBannerForm({...emptyBannerForm,...item,slideshow_type:'automatic',slideshow_effect:item.slideshow_effect||'slide-left',image_size:'placement',image_fit:item.image_fit||'cover',image_urls:Array.isArray(item.image_urls)?item.image_urls:(item.image_url?[item.image_url]:[]),sort_order:String(item.sort_order??0),starts_at:item.starts_at||'',ends_at:item.ends_at||''});}}>Edit</Btn><Btn outline onPress={()=>toggleBanner(item)}>{item.is_active?'Hide':'Publish'}</Btn><Btn outline onPress={()=>deleteBanner(item.id)}>Delete</Btn></View></View>):<Empty icon="images-outline" title="No banners created" detail="Create a hero banner or deal tile above. Your storefront keeps its existing default promotions until you publish replacements."/>}</View></>;
 if(page==='Homepage Categories'){
 const selectableMenuItems=menuItems.filter(item=>['category','subcategory'].includes(getMenuType(item))&&item.is_active!==false);
 const selectedIds=Array.isArray(branding.homepage_category_ids)?branding.homepage_category_ids:[];
 const toggleHomepageCategory=id=>{homepageSelectionDirty.current=true;setBranding(prev=>{const current=Array.isArray(prev.homepage_category_ids)?prev.homepage_category_ids:[];if(current.includes(id))return {...prev,homepage_category_ids:current.filter(x=>x!==id)};if(current.length>=10){setError('You can select a maximum of 10 homepage categories or subcategories.');return prev;}return {...prev,homepage_category_ids:[...current,id]};});};
 const moveHomepageCategory=(id,direction)=>{homepageSelectionDirty.current=true;setBranding(prev=>{const current=Array.isArray(prev.homepage_category_ids)?[...prev.homepage_category_ids]:[];const index=current.indexOf(id);const next=index+direction;if(index<0||next<0||next>=current.length)return prev;[current[index],current[next]]=[current[next],current[index]];return {...prev,homepage_category_ids:current};});};
 return <><PageHeader title="Homepage categories" subtitle="Choose up to 10 category or subcategory product rows to display on the storefront." onRefresh={loadData} loading={loading}/><View style={s.notice}><Ionicons name="information-circle-outline" size={22} color={GREEN}/><View style={{flex:1}}><Text style={s.rowTitle}>Choose the homepage product sections</Text><Text style={s.muted}>Select categories or subcategories from Storefront Navigation. Selection order controls homepage order. Each section shows up to 10 available products. Your round “Shop by category” tiles are not affected.</Text></View></View><View style={s.panel}><View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>Available categories</Text><Text style={s.muted}>{selectedIds.length} of 10 selected</Text></View><Pill label={`${selectedIds.length}/10 selected`}/></View>{selectableMenuItems.length?selectableMenuItems.map(item=>{const selected=selectedIds.includes(item.id);const selectedIndex=selectedIds.indexOf(item.id);const parent=menuItems.find(x=>x.id===item.parent_id);return <View key={item.id} style={{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:10,borderBottomWidth:1,borderColor:'#EEF2EF'}}><Pressable onPress={()=>toggleHomepageCategory(item.id)} style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:11,paddingVertical:2}}><Ionicons name={selected?'checkbox':'square-outline'} size={23} color={selected?GREEN:MUTED}/><View style={{flex:1,minWidth:0}}><Text style={s.rowTitle}>{item.label}</Text><Text style={s.muted}>{getMenuType(item)==='category'?'Category':'Subcategory'}{parent?` · ${parent.label}`:''}</Text></View>{selected?<Pill label={`#${selectedIndex+1}`}/>:null}</Pressable>{selected?<View style={{flexDirection:'row',gap:5}}><Pressable accessibilityLabel={`Move ${item.label} up`} disabled={selectedIndex===0} onPress={()=>moveHomepageCategory(item.id,-1)} style={{width:34,height:34,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:LINE,borderRadius:8,opacity:selectedIndex===0?0.3:1}}><Ionicons name="chevron-up" size={19} color={GREEN}/></Pressable><Pressable accessibilityLabel={`Move ${item.label} down`} disabled={selectedIndex===selectedIds.length-1} onPress={()=>moveHomepageCategory(item.id,1)} style={{width:34,height:34,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:LINE,borderRadius:8,opacity:selectedIndex===selectedIds.length-1?0.3:1}}><Ionicons name="chevron-down" size={19} color={GREEN}/></Pressable></View>:null}</View>;}):<Empty icon="albums-outline" title="No categories available" detail="Create categories or subcategories first in Menu Management."/>}<View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginTop:12}}><Btn disabled={brandingSaving} onPress={saveBranding}>{brandingSaving?'Saving…':'Save homepage selection'}</Btn><Btn outline onPress={()=>{homepageSelectionDirty.current=true;setBranding(prev=>({...prev,homepage_category_ids:[]}));}}>Clear selection</Btn></View><Text style={s.muted}>When no items are selected, the storefront keeps its current automatic category-section behaviour.</Text></View></>;
}
if(page==='Overview')return <><View style={s.pageHead}><View><Text style={s.pageTitle}>Good day, Kanev team</Text><Text style={s.muted}>Here’s your pharmacy operations at a glance.</Text></View><Btn outline onPress={loadData}>{loading?'Refreshing…':'↻ Refresh'}</Btn></View><View style={[s.metrics,{gridTemplateColumns:undefined}]}>{[["receipt-outline","Orders",stats.orders,`${stats.pending} pending`,GREEN],["cash-outline","Confirmed revenue",money(stats.revenue),'Paid / completed orders',BLUE],["medkit-outline","Products",stats.products,'Catalogue items', '#8A6D19'],["people-outline","Customers",stats.customers,'Customer profiles','#7B4E9B']].map((m,i)=><Metric key={i} icon={m[0]} label={m[1]} value={m[2]} sub={m[3]} color={m[4]}/>)}</View><View style={s.panel}><View style={s.panelHead}><Text style={s.panelTitle}>Recent orders</Text><Pressable onPress={()=>setPage('Orders')}><Text style={s.link}>View all →</Text></Pressable></View>{orders.slice(0,5).length?orders.slice(0,5).map(o=><OrderRow key={o.id} item={o}/>):<Empty icon="receipt-outline" title="No orders yet" detail="Customer orders will appear here once submitted."/>}</View><View style={s.panel}><Text style={s.panelTitle}>Low stock watch</Text>{products.filter(p=>Number(p.stock_quantity||0)<=5).slice(0,5).map(p=><View key={p.id} style={s.listRow}><View style={{flex:1}}><Text style={s.rowTitle}>{p.name}</Text><Text style={s.muted}>Stock remaining: {p.stock_quantity}</Text></View><Pill label={Number(p.stock_quantity)===0?'Out of stock':'Low stock'} danger/></View>)}{!products.some(p=>Number(p.stock_quantity||0)<=5)&&<Text style={s.muted}>No low-stock items in the loaded catalogue.</Text>}</View></>;
 if(page==='Orders')return <><PageHeader title="Orders" subtitle="Select a tracking ID to view order progress and manage the order." onRefresh={loadData} loading={loading}/><Field label="Search orders" value={search} onChangeText={setSearch} placeholder="Order number, customer or status"/>{filteredOrders.length?filteredOrders.map(o=>{const open=expandedAdminOrderId===o.id;return <View key={o.id} style={s.panel}><View style={s.orderRow}><View style={s.orderIcon}><Ionicons name="receipt-outline" size={19} color={GREEN}/></View><View style={{flex:1,minWidth:0,gap:4}}><Text style={s.rowTitle}>{o.order_number||`Order ${String(o.id).slice(0,8)}`}</Text><Text style={s.muted} numberOfLines={1}>{o.customer_name||'Customer'} · {o.customer_phone||'No phone'}</Text><Pressable onPress={()=>setExpandedAdminOrderId(open?null:o.id)} accessibilityRole="button" accessibilityLabel={`${open?'Collapse':'Expand'} tracking details for ${o.order_number||'order'}`} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,paddingVertical:4}}><Text style={{color:GREEN,fontSize:12,fontWeight:'900'}}>Tracking: {o.tracking_code||`KAN-${String(o.order_number||o.id).replace(/^KAN-/,'')}`}</Text><Ionicons name={open?'chevron-up':'chevron-down'} size={16} color={GREEN}/></Pressable></View><View style={{alignItems:'flex-end',gap:5}}><Text style={s.rowTitle}>{money(o.total_zmw)}</Text><Pill label={o.delivery_status||o.status||'pending'} danger={['cancelled','failed'].includes(String(o.status).toLowerCase())}/></View></View>{open?<View style={{marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:LINE}}><Text style={s.muted}>Placed: {o.created_at?new Date(o.created_at).toLocaleString(): '—'}</Text><Text style={s.muted}>Fulfilment: {String(o.fulfilment||'not specified').replaceAll('_',' ')}</Text>{o.delivery_address?<Text style={s.muted}>Address: {o.delivery_address}</Text>:null}{o.delivery_notes?<Text style={s.muted}>Instructions: {o.delivery_notes}</Text>:null}{o.delivery_partner?<Text style={s.muted}>Courier: {o.delivery_partner}</Text>:null}<AdminOrderProgress status={o.status} fulfilment={o.fulfilment}/><View style={s.actions}><Pressable onPress={()=>toggleOrderItems(o.id)} style={s.smallAction}><Text style={s.smallActionText}>{expandedOrderId===o.id?'Hide items':'View items'}</Text></Pressable>{[...ORDER_STEPS,{status:'cancelled',label:'Cancelled'}].map((step)=>{const allowed=allowedNextOrderStatuses(o).includes(step.status);const active=String(o.status||'').toLowerCase()===step.status;const disabled=loading||!allowed||active||terminalOrderStatus(o.status);return <Pressable key={step.status} onPress={()=>updateOrder(o.id,step.status)} disabled={disabled} style={[s.smallAction,{opacity:disabled?0.35:1,backgroundColor:active?'#E7F3EC':'#FFFFFF',borderColor:active?GREEN:LINE}]}><Text style={[s.smallActionText,disabled&&{color:'#87958E'}]}>{step.label}</Text></Pressable>;})}</View>{expandedOrderId===o.id?<View style={{marginTop:12,padding:12,borderRadius:10,backgroundColor:'#F7FAF8',borderWidth:1,borderColor:LINE}}><Text style={s.panelTitle}>Order items</Text>{orderItemsLoadingId===o.id?<Text style={s.muted}>Loading items…</Text>:!orderItemsById[o.id]?.length?<Text style={s.muted}>No item details found for this order.</Text>:orderItemsById[o.id].map(item=><View key={item.id} style={[s.listRow,{alignItems:'center'}]}><View style={{flex:1}}><Text style={s.rowTitle}>{item.product_name_snapshot}</Text><Text style={s.muted}>{money(item.unit_price_zmw)} × {item.quantity}</Text></View><Text style={s.rowTitle}>{money(item.line_total_zmw)}</Text></View>)}<View style={[s.listRow,{borderTopWidth:1,borderTopColor:LINE,marginTop:5,paddingTop:10}]}><Text style={s.rowTitle}>Order total</Text><Text style={s.rowTitle}>{money(o.total_zmw)}</Text></View></View>:null}</View>:null}</View>;}):<Empty icon="receipt-outline" title="No matching orders" detail="Orders will be listed here when available."/>}</>;
 if(page==='Products')return <><PageHeader title="Products & categories" subtitle="Manage products, assign catalogue categories and upload product photos directly from your device." onRefresh={loadData} loading={loading}/>
  <View style={{flexDirection:width>=1180?'row':'column',alignItems:'flex-start',gap:15}}>
   <View style={[s.panel,{flex:width>=1180?2:undefined,width:width>=1180?'auto':'100%',minWidth:0}]}>
    <View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>{productForm.id?`Edit product: ${productForm.name}`:'Add a product'}</Text><Text style={s.muted}>Required fields are marked with *.</Text></View><Pill label="New product"/></View>
    <Field label="Product name *" value={productForm.name} onChangeText={v=>setProductForm({...productForm,name:v})} placeholder="e.g. Vitamin C 500 mg"/>
    <Field label="Slug (optional)" value={productForm.slug} onChangeText={v=>setProductForm({...productForm,slug:v})} placeholder="Auto-generated from product name"/>
    <Field label="Product summary" value={productForm.summary} onChangeText={v=>setProductForm({...productForm,summary:v})} placeholder="Short highlights shown beside the product image (e.g. what it is, key benefits, pack size)."/><Text style={[s.muted,{marginTop:-7,marginBottom:12}]}>This appears in the product information area beside the image. Keep it short and separate from the full description below.</Text><Field label="Full description" value={productForm.description} onChangeText={v=>setProductForm({...productForm,description:v})} placeholder="Detailed product information, uses and directions"/>
    <View style={[s.formGrid,{flexWrap:'wrap'}]}><View style={{flex:1,minWidth:180}}><Field label="Selling price (ZMW) *" value={productForm.price_zmw} onChangeText={v=>setProductForm({...productForm,price_zmw:v})} keyboardType="decimal-pad"/></View><View style={{flex:1,minWidth:180}}><Field label="Original price (ZMW, optional)" value={productForm.original_price_zmw} onChangeText={v=>setProductForm({...productForm,original_price_zmw:v})} keyboardType="decimal-pad"/></View><View style={{flex:1,minWidth:180}}><Field label="Star rating (0–5)" value={productForm.rating} onChangeText={v=>setProductForm({...productForm,rating:v})} keyboardType="decimal-pad"/></View><View style={{flex:1,minWidth:180}}><Field label="Stock quantity" value={productForm.stock_quantity} onChangeText={v=>setProductForm({...productForm,stock_quantity:v})} keyboardType="number-pad"/></View></View>
    <View style={[s.formGrid,{flexWrap:'wrap'}]}><View style={{flex:1,minWidth:180}}><Field label="Low-stock alert threshold" value={productForm.low_stock_threshold} onChangeText={v=>setProductForm({...productForm,low_stock_threshold:v})} keyboardType="number-pad"/></View><View style={{flex:1,minWidth:180}}><Field label="Expiry date (YYYY-MM-DD)" value={productForm.expiry_date} onChangeText={v=>setProductForm({...productForm,expiry_date:v})} placeholder="e.g. 2027-05-31"/></View></View>
    <Field label="Schedule publication (optional, include timezone)" value={productForm.scheduled_at||''} onChangeText={v=>setProductForm({...productForm,scheduled_at:v})} placeholder="2026-10-27T09:00:00+02:00"/>
    <Text style={s.muted}>Leave blank to publish normally. For a future date, the product remains hidden until the scheduled publication job runs.</Text>
    <View style={{borderWidth:1,borderColor:'#D7E8DD',backgroundColor:'#F7FBF8',borderRadius:11,padding:9,marginBottom:13,gap:8}}>
     <Text style={{fontSize:13,fontWeight:'900',color:GREEN}}>Product categories *</Text>
     <Text style={[s.muted,{fontSize:11}]}>Select multiple main categories below. Subcategories appear for every selected main category, so you can assign any combination without leaving this section.</Text>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{productParentCategories.filter(c=>c.is_active!==false).map(c=>{
       const selected=(productForm.category_ids||[]).includes(c.id)||productForm.category_id===c.id;
       return <Pressable key={c.id} onPress={()=>toggleProductParentWithChildren(c,(menuCategoryItems.find(item=>normalizeCategoryName(item.label)===normalizeCategoryName(c.name))?menuSubcategoryItems.filter(item=>item.parent_id===menuCategoryItems.find(item=>normalizeCategoryName(item.label)===normalizeCategoryName(c.name)).id).map(m=>categories.find(cat=>normalizeCategoryName(cat.name)===normalizeCategoryName(m.label))?.id).filter(Boolean):[]))} style={{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:7,paddingHorizontal:9,borderWidth:1,borderColor:selected?GREEN:'#D8E5DC',borderRadius:8,backgroundColor:selected?'#E4F3E9':'#FFFFFF'}}><Ionicons name={selected?'checkbox':'square-outline'} size={15} color={selected?GREEN:MUTED}/><Text style={{fontSize:11,fontWeight:'800',color:selected?GREEN:INK}}>{c.name}</Text></Pressable>;
     })}</View>
     {productParentCategories.filter(c=>c.is_active!==false&&((productForm.category_ids||[]).includes(c.id)||productForm.category_id===c.id)).map(c=>{
       const parentMenu=menuCategoryItems.find(item=>normalizeCategoryName(item.label)===normalizeCategoryName(c.name));
       const childRows=parentMenu?menuSubcategoryItems.filter(item=>item.parent_id===parentMenu.id).map(menuItem=>({menuItem,category:categories.find(category=>normalizeCategoryName(category.name)===normalizeCategoryName(menuItem.label))})):[];
       if(!childRows.length)return null;
       return <View key={`subs-${c.id}`} style={{borderTopWidth:1,borderColor:'#DCEAE0',paddingTop:7,gap:5}}>
        <Text style={{fontSize:11,fontWeight:'900',color:INK}}>{c.name} subcategories</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>{childRows.map(({menuItem,category})=>{
          const childSelected=!!category&&((productForm.category_ids||[]).includes(category.id)||productForm.category_id===category.id);
          return <Pressable key={menuItem.id} onPress={()=>category?toggleProductSubcategoryForParent(category.id,c.id):selectProductSubcategory(menuItem,null,c.id)} style={{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:6,paddingHorizontal:8,borderWidth:1,borderColor:childSelected?GREEN:'#DDE7E0',borderRadius:7,backgroundColor:childSelected?'#E4F3E9':'#FFFFFF'}}><Ionicons name={childSelected?'checkbox':'square-outline'} size={14} color={childSelected?GREEN:MUTED}/><Text style={{fontSize:11,fontWeight:'700',color:childSelected?GREEN:INK}}>{menuItem.label}</Text>{!category?<Text style={{fontSize:10,color:MUTED}}>+ create</Text>:null}</Pressable>;
        })}</View>
       </View>;
     })}
     {categories.filter(c=>subcategoryNameSet.has(normalizeCategoryName(c.name))&&!menuSubcategoryItems.some(m=>normalizeCategoryName(m.label)===normalizeCategoryName(c.name))).length>0?<View style={{borderTopWidth:1,borderColor:'#DCEAE0',paddingTop:7,gap:5}}><Text style={{fontSize:11,fontWeight:'900',color:INK}}>Other catalogue categories</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>{categories.filter(c=>subcategoryNameSet.has(normalizeCategoryName(c.name))&&!menuSubcategoryItems.some(m=>normalizeCategoryName(m.label)===normalizeCategoryName(c.name))).map(c=>{const selected=(productForm.category_ids||[]).includes(c.id)||productForm.category_id===c.id;return <Pressable key={c.id} onPress={()=>toggleProductCategory(c.id)} style={{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:6,paddingHorizontal:8,borderWidth:1,borderColor:selected?GREEN:'#DDE7E0',borderRadius:7,backgroundColor:selected?'#E4F3E9':'#FFFFFF'}}><Ionicons name={selected?'checkbox':'square-outline'} size={14} color={selected?GREEN:MUTED}/><Text style={{fontSize:11,fontWeight:'700',color:selected?GREEN:INK}}>{c.name}</Text></Pressable>;})}</View></View>:null}
     {!categories.length?<Text style={s.muted}>No product categories yet. Add a category or sync from Menu Management.</Text>:null}
     <Text style={[s.muted,{fontSize:11}]}>{Array.from(new Set([...(productForm.category_ids||[]),productForm.category_id].filter(id=>categories.some(c=>c.id===id)))).length} category/subcategory assignment(s) selected.</Text>
    </View>
    <View style={[s.formGrid,{flexWrap:'wrap'}]}><View style={{flex:1,minWidth:180}}><Field label="Brand" value={productForm.brand} onChangeText={v=>setProductForm({...productForm,brand:v})}/></View><View style={{flex:1,minWidth:180}}><Field label="SKU / barcode" value={productForm.sku} onChangeText={v=>setProductForm({...productForm,sku:v})}/></View></View>
    <View style={{borderWidth:1,borderColor:LINE,borderRadius:13,padding:12,marginBottom:14,backgroundColor:'#FBFDFC',gap:10}}>
     <Text style={s.label}>Product images (up to 8)</Text>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>
      {(productForm.image_urls|| (productForm.image_url?[productForm.image_url]:[])).map((url,index)=><View key={url+index} style={{width:92,gap:4}}><Image source={{uri:url}} resizeMode="contain" style={{width:88,height:88,borderRadius:9,borderWidth:1,borderColor:LINE,backgroundColor:'#fff'}}/><Text style={{fontSize:10,color:index===0?GREEN:MUTED,fontWeight:index===0?'900':'600'}}>{index===0?'Main image':`Image ${index+1}`}</Text><Btn outline onPress={()=>setProductForm(prev=>{const images=(prev.image_urls||[prev.image_url].filter(Boolean)).filter((_,i)=>i!==index);return {...prev,image_urls:images,image_url:images[0]||''};})}>Remove</Btn></View>)}
      {!(productForm.image_urls||[]).length&&!productForm.image_url?<View style={{width:92,height:88,borderRadius:9,borderWidth:1,borderStyle:'dashed',borderColor:'#B9CCC1',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={27} color={MUTED}/><Text style={{fontSize:10,color:MUTED}}>No images</Text></View>:null}
     </View>
     <Btn outline onPress={chooseProductImage} disabled={productImageUploading}>{productImageUploading?'Uploading images…':'Add images from device'}</Btn>
     <Text style={s.muted}>Choose one or more JPG, PNG or WebP images (up to 8 total, maximum 5 MB each). The first image is the main product image. Recommended: 1200 × 1200 px, product centred on a clean background. Images upload directly to pharmacy storage.</Text>
    </View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Btn onPress={saveProduct} disabled={busy||productImageUploading}>{busy?'Saving…':productForm.id?'Update product':'Save product'}</Btn><Btn outline onPress={()=>setProductForm({...emptyProductForm})}>{productForm.id?'Cancel edit':'Clear form'}</Btn></View>
    <Text style={s.muted}>Products are assigned to a catalogue category. Menu navigation labels remain managed in Menu Management.</Text>
   </View>
   <View style={[s.panel,{flex:width>=1180?1:undefined,width:width>=1180?'auto':'100%',minWidth:0}]}>
    <View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>Categories</Text><Text style={s.muted}>Categories used for product assignment.</Text></View><Pill label={`${categories.length}`}/></View>
    <View style={{flexDirection:'row',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}><View style={{flex:1,minWidth:180}}><Field label="New product category" value={newCategoryName} onChangeText={setNewCategoryName} placeholder="e.g. Skincare"/></View><View style={{paddingTop:20}}><Btn outline onPress={()=>uploadCategoryImage(null)} disabled={newCategoryImageBusy}>{newCategoryImageBusy?'Uploading…':'Choose image'}</Btn></View><View style={{paddingTop:20}}><Btn onPress={createCatalogueCategory} disabled={categorySaving||newCategoryImageBusy}>{categorySaving?'Saving…':'Add'}</Btn></View></View>
    {newCategoryImageUrl?<View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10}}><Image source={{uri:newCategoryImageUrl}} style={{width:58,height:58,borderRadius:29,backgroundColor:'#F1F5F2'}} resizeMode="cover"/><Text style={s.muted}>Selected category image</Text><Btn outline onPress={()=>setNewCategoryImageUrl('')}>Remove</Btn></View>:<Text style={s.muted}>Optional image: choose a square JPG, PNG or WebP image up to 5 MB. It will appear in the storefront category carousel.</Text>}
    <Btn outline onPress={syncMenuCategories} disabled={categorySaving}>{categorySaving?'Working…':'Sync categories from Menu Management'}</Btn>
    <Text style={s.muted}>This copies missing category/subcategory names into product categories so you can assign products. Category images are saved to the database and used by the storefront carousel.</Text>
    <View style={{gap:10,marginTop:8}}>{productParentCategories.map(c=>{const parentMenu=menuCategoryItems.find(item=>normalizeCategoryName(item.label)===normalizeCategoryName(c.name));const childRows=parentMenu?menuSubcategoryItems.filter(item=>item.parent_id===parentMenu.id).map(item=>({menuItem:item,category:categories.find(category=>normalizeCategoryName(category.name)===normalizeCategoryName(item.label))})):[];return <View key={c.id} style={{borderWidth:1,borderColor:LINE,borderRadius:12,padding:10,backgroundColor:productForm.category_id===c.id?'#F0F8F2':'#FFFFFF',gap:9}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>{c.image_url?<Image source={{uri:c.image_url}} style={{width:58,height:58,borderRadius:29,backgroundColor:'#F1F5F2'}} resizeMode="cover"/>:<View style={{width:58,height:58,borderRadius:29,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={22} color={GREEN}/></View>}
       <Pressable onPress={()=>selectProductParentCategory(c)} style={{flex:1,minWidth:0}}><Text style={s.rowTitle}>{c.name}</Text><Text style={s.muted}>{childRows.length?`${childRows.length} subcategor${childRows.length===1?'y':'ies'} · Main category`:'Product catalogue category'}</Text><Pill label={c.is_active?'Active':'Inactive'} danger={!c.is_active}/></Pressable>{productForm.category_id===c.id?<Ionicons name="checkmark-circle" size={19} color={GREEN}/>:null}</View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}><Btn outline onPress={()=>uploadCategoryImage(c.id)} disabled={categoryImageBusyId===c.id}>{categoryImageBusyId===c.id?'Uploading…':c.image_url?'Replace image':'Add image'}</Btn><Btn outline onPress={()=>selectProductParentCategory(c)}>Assign main category</Btn></View>
      {childRows.length?<View style={{marginTop:2,marginLeft:7,paddingLeft:11,borderLeftWidth:2,borderLeftColor:'#D7E8DD',gap:8}}>{childRows.map(({menuItem,category})=>category?<View key={menuItem.id} style={{borderWidth:1,borderColor:'#E2EBE5',borderRadius:10,padding:9,backgroundColor:productForm.category_id===category.id?'#F0F8F2':'#FBFDFC',gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:9}}>{category.image_url?<Image source={{uri:category.image_url}} style={{width:42,height:42,borderRadius:21,backgroundColor:'#F1F5F2'}} resizeMode="cover"/>:<View style={{width:42,height:42,borderRadius:21,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="albums-outline" size={18} color={GREEN}/></View>}<View style={{flex:1,minWidth:0}}><Text style={s.rowTitle}>↳ {category.name}</Text><Text style={s.muted}>Subcategory of {c.name}</Text></View>{productForm.category_id===category.id?<Ionicons name="checkmark-circle" size={18} color={GREEN}/>:null}</View><View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}><Btn outline onPress={()=>uploadCategoryImage(category.id)} disabled={categoryImageBusyId===category.id}>{categoryImageBusyId===category.id?'Uploading…':category.image_url?'Replace image':'Add image'}</Btn><Btn outline onPress={()=>{toggleProductCategory(category.id);setError('');}}>Assign subcategory</Btn></View></View>:<Text key={menuItem.id} style={s.muted}>↳ {menuItem.label} · Sync categories to create its product assignment record.</Text>)}</View>:null}
    </View>})}{categories.filter(c=>subcategoryNameSet.has(normalizeCategoryName(c.name))&&!menuSubcategoryItems.some(m=>normalizeCategoryName(m.label)===normalizeCategoryName(c.name))).map(c=><View key={c.id} style={{borderWidth:1,borderColor:LINE,borderRadius:12,padding:10,gap:8}}><Text style={s.rowTitle}>{c.name}</Text><Text style={s.muted}>No parent link found in Menu Management · standalone catalogue category</Text><View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}><Btn outline onPress={()=>uploadCategoryImage(c.id)}>{c.image_url?'Replace image':'Add image'}</Btn><Btn outline onPress={()=>toggleProductCategory(c.id)}>Assign to product</Btn></View></View>)}{!categories.length?<Empty icon="albums-outline" title="No product categories yet" detail="Add a category above or sync categories created in Menu Management."/>:null}</View>
    <View style={{borderTopWidth:1,borderColor:LINE,paddingTop:12,marginTop:8}}><Text style={s.panelTitle}>Menu hierarchy</Text>{menuItems.filter(m=>{const parent=menuItems.find(x=>x.id===m.parent_id);const type=m.node_type||(m.parent_id?(parent?.node_type==='category'?'subcategory':'category'):'menu');return type==='category';}).map(c=>{const parent=menuItems.find(x=>x.id===c.parent_id);const subs=menuItems.filter(x=>x.parent_id===c.id);return <View key={c.id} style={{paddingVertical:8,borderBottomWidth:1,borderColor:'#EEF2EF'}}><Text style={s.rowTitle}>{parent?.label||'Menu'} / {c.label}</Text>{subs.map(sub=><Text key={sub.id} style={[s.muted,{paddingLeft:12}]}>↳ {sub.label}</Text>)}</View>})}{!menuItems.length?<Text style={s.muted}>Create menu items in Menu Management first.</Text>:null}</View>
   </View>
  </View>
  <View style={s.panel}><View style={s.panelHead}><Text style={s.panelTitle}>Product catalogue</Text><Pill label={`${filteredProducts.length} products`}/></View><Field label="Search products" value={search} onChangeText={setSearch} placeholder="Search by product name or slug"/>{filteredProducts.map(p=><View key={p.id} style={[s.listRow,{flexWrap:'wrap'}]}>{p.image_url?<Image source={{uri:p.image_url}} style={{width:54,height:54,borderRadius:8,backgroundColor:'#F4F8F5'}} resizeMode="contain"/>:<View style={{width:54,height:54,borderRadius:8,backgroundColor:'#F4F8F5',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={20} color={MUTED}/></View>}<View style={{flex:1,minWidth:150}}><Text style={s.rowTitle}>{p.name}</Text><Text style={s.muted}>{money(p.price_zmw)} · Stock {p.stock_quantity} · {p.is_active?'Published':'Hidden'}</Text></View><Pill label={Number(p.stock_quantity)===0?'Out of stock':p.requires_prescription?'Prescription':'In stock'} danger={Number(p.stock_quantity)===0}/><Btn outline onPress={()=>{setProductForm({id:p.id,name:p.name||'',slug:p.slug||'',description:p.description||'',price_zmw:String(p.price_zmw??''),original_price_zmw:String(p.original_price_zmw??''),rating:String(p.rating??5),stock_quantity:String(p.stock_quantity??0),brand:p.brand||'',sku:p.sku||'',image_url:p.image_url||'',category_id:p.category_id||'',category_ids:p.category_ids?.length?p.category_ids:(p.category_id?[p.category_id]:[]),is_active:!!p.is_active,requires_prescription:!!p.requires_prescription});setError('Product loaded for editing. Make changes above, then choose Update product.');}} >Edit</Btn><Btn outline disabled={busy} onPress={()=>toggleProductPause(p)}>{p.is_active?'Pause':'Resume'}</Btn><Btn outline disabled={busy} onPress={()=>scheduleProduct(p)}>Schedule</Btn><Btn outline disabled={busy} onPress={()=>deleteProduct(p)}>Delete</Btn></View>)}{!filteredProducts.length?<Empty icon="medkit-outline" title="No products found" detail="Add your first product using the form above."/>:null}</View>
 </>;
 if(page==='Menu Management')return <><PageHeader title="Storefront navigation" subtitle="Build the customer menu in three clear levels: Main menu → Category → Subcategory." onRefresh={loadData} loading={loading}/>
  <View style={s.notice}><Ionicons name="git-network-outline" size={23} color={GREEN}/><View style={{flex:1}}><Text style={s.rowTitle}>How the navigation is organised</Text><Text style={s.muted}>Create a main menu such as Personal Care, add categories such as Skin Care beneath it, then add subcategories such as Body Lotions. Use the actions on each row to add the next level in the right place.</Text></View></View>
  <View style={s.panel}>
   <View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>{menuForm.id?'Edit navigation item':'Create a menu item'}</Text><Text style={s.muted}>Step 1 · Choose what you are adding</Text></View><Pressable onPress={()=>setMenuForm({id:null,label:'',node_type:'menu',parent_id:'',sort_order:String((menuItems.length+1)*10),is_active:true,destination_type:'category',destination_value:''})} style={s.smallAction}><Text style={s.smallActionText}>Clear form</Text></Pressable></View>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:4}}>{[
    ['menu','Main menu','Top navigation label','grid-outline'],['category','Category','A section under a menu','folder-open-outline'],['subcategory','Subcategory','A section under a category','albums-outline']
   ].map(([value,label,desc,icon])=><Pressable key={value} onPress={()=>setMenuForm({...menuForm,node_type:value,parent_id:value==='menu'?'':menuForm.parent_id,id:menuForm.id&&menuForm.node_type===value?menuForm.id:null,label:menuForm.id&&menuForm.node_type===value?menuForm.label:'',sort_order:String((menuItems.length+1)*10)})} style={{flexGrow:1,flexBasis:175,borderWidth:1,borderColor:menuForm.node_type===value?GREEN:LINE,backgroundColor:menuForm.node_type===value?'#EAF5EE':'#FFFFFF',borderRadius:12,padding:12,gap:5}}><Ionicons name={icon} size={20} color={menuForm.node_type===value?GREEN:MUTED}/><Text style={{fontSize:13,fontWeight:'900',color:INK}}>{label}</Text><Text style={{fontSize:11,color:MUTED}}>{desc}</Text>{menuForm.node_type===value?<Text style={{fontSize:10,color:GREEN,fontWeight:'900'}}>SELECTED</Text>:null}</Pressable>)}</View>
   <Text style={s.muted}>Step 2 · {menuForm.node_type==='menu'?'Name the main menu':menuForm.node_type==='category'?'Choose the main menu this category belongs to':'Choose the category this subcategory belongs to'}</Text>
   {menuForm.node_type!=='menu'?<View style={{gap:7,marginBottom:12}}>{menuItems.filter(m=>m.id!==menuForm.id&&(menuForm.node_type==='category'?(m.node_type||(!m.parent_id?'menu':'category'))==='menu':(m.node_type||(!m.parent_id?'menu':'category'))==='category')).map(m=>{const parent=menuItems.find(x=>x.id===m.parent_id);const selected=menuForm.parent_id===m.id;return <Pressable key={m.id} onPress={()=>setMenuForm({...menuForm,parent_id:m.id})} style={{borderWidth:1,borderColor:selected?GREEN:LINE,backgroundColor:selected?'#EAF5EE':'#fff',borderRadius:10,padding:11,flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name={selected?'radio-button-on':'radio-button-off'} size={19} color={selected?GREEN:MUTED}/><View style={{flex:1}}><Text style={s.rowTitle}>{m.label}</Text><Text style={s.muted}>{menuForm.node_type==='category'?'Main menu':'Category'}{parent?` · under ${parent.label}`:''}</Text></View></Pressable>})}{!menuItems.some(m=>m.id!==menuForm.id&&(menuForm.node_type==='category'?(m.node_type||(!m.parent_id?'menu':'category'))==='menu':(m.node_type||(!m.parent_id?'menu':'category'))==='category'))?<Text style={s.muted}>{menuForm.node_type==='category'?'Create a main menu first.':'Create a category under a main menu first.'}</Text>:null}</View>:<View style={{backgroundColor:'#F4F8F5',borderRadius:10,padding:11,marginBottom:12,flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name="checkmark-circle" color={GREEN} size={18}/><Text style={{color:GREEN,fontWeight:'800',fontSize:12}}>Main navigation level · no parent needed</Text></View>}
   <Field label="Display name *" value={menuForm.label} onChangeText={v=>setMenuForm({...menuForm,label:v})} placeholder={menuForm.node_type==='menu'?'e.g. Personal Care':menuForm.node_type==='category'?'e.g. Skin Care':'e.g. Body Lotions'}/>
   <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}><View style={{flex:1,minWidth:160}}><Field label="Display order (lower first)" value={String(menuForm.sort_order)} onChangeText={v=>setMenuForm({...menuForm,sort_order:v})} keyboardType="number-pad"/></View><View style={{flex:1,minWidth:160,gap:6,marginBottom:12}}><Text style={s.label}>Visibility</Text><Pressable onPress={()=>setMenuForm({...menuForm,is_active:!menuForm.is_active})} style={[s.input,{justifyContent:'center',backgroundColor:menuForm.is_active?'#EAF5EE':'#FFF0EF',borderColor:menuForm.is_active?'#C8E2D0':'#F2B7B1'}]}><Text style={{fontSize:12,fontWeight:'800',color:menuForm.is_active?GREEN:'#B42318'}}>{menuForm.is_active?'Visible on storefront':'Hidden from storefront'}</Text></Pressable></View></View>
   <Text style={s.muted}>Step 3 · Choose what products this item opens</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginVertical:6}}>{[['category','Match product category'],['all','All products'],['url','External URL']].map(([value,label])=><Pressable key={value} onPress={()=>setMenuForm({...menuForm,destination_type:value})} style={[s.smallAction,menuForm.destination_type===value&&{backgroundColor:'#EAF5EE',borderColor:GREEN}]}><Text style={s.smallActionText}>{label}</Text></Pressable>)}</View>
   <Field label={menuForm.destination_type==='url'?'Destination URL':menuForm.destination_type==='all'?'Optional product filter':'Product category / filter name'} value={menuForm.destination_value} onChangeText={v=>setMenuForm({...menuForm,destination_value:v})} placeholder={menuForm.destination_type==='url'?'https://…':menuForm.destination_type==='all'?'Leave blank to show all products':menuForm.node_type==='subcategory'?'e.g. Body Lotions':'e.g. Skin Care'}/>
   <View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginTop:4}}><Btn onPress={saveMenuItem} disabled={busy||(menuForm.node_type!=='menu'&&!menuForm.parent_id)}>{busy?'Saving…':menuForm.id?'Save changes':`Create ${menuForm.node_type==='menu'?'main menu':menuForm.node_type==='category'?'category':'subcategory'}`}</Btn>{menuForm.id?<Btn outline onPress={()=>setMenuForm({id:null,label:'',node_type:'menu',parent_id:'',sort_order:String((menuItems.length+1)*10),is_active:true,destination_type:'category',destination_value:''})}>Cancel editing</Btn>:null}</View>
  </View>
  <View style={s.panel}><View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>Your navigation structure</Text><Text style={s.muted}>{menuItems.length} items · Add the next level directly from each parent below.</Text></View></View>
   {menuTreeRows().map(item=>{const type=item.node_type||(!item.parent_id?'menu':menuItems.find(m=>m.id===item.parent_id)?.node_type==='menu'?'category':'subcategory');const canAdd=type==='menu'||type==='category';const nextType=type==='menu'?'category':'subcategory';return <View key={item.id} style={{marginLeft:Math.min(item._depth*18,54),marginTop:8,borderWidth:1,borderColor:item._depth===0?'#CFE2D7':'#E5ECE7',borderRadius:12,backgroundColor:item._depth===0?'#F8FBF9':'#FFFFFF',padding:12}}><View style={{flexDirection:'row',alignItems:'flex-start',gap:9}}><View style={{width:34,height:34,borderRadius:10,backgroundColor:item._depth===0?'#DDEFE4':'#F0F5F1',alignItems:'center',justifyContent:'center'}}><Ionicons name={type==='menu'?'grid-outline':type==='category'?'folder-open-outline':'pricetag-outline'} size={17} color={GREEN}/></View><View style={{flex:1,minWidth:0,gap:3}}><Text style={s.rowTitle}>{item.label}</Text><Text style={s.muted}>{({menu:'MAIN MENU',category:'CATEGORY',subcategory:'SUBCATEGORY'})[type]} · Order {item.sort_order??0}</Text><Text style={{fontSize:11,color:MUTED}}>{item.destination_type==='url'?'External link':item.destination_type==='all'?'All products':`Product filter: ${item.destination_value||item.label}`}</Text></View><Pill label={item.is_active?'Visible':'Hidden'} danger={!item.is_active}/></View><View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10,paddingTop:9,borderTopWidth:1,borderColor:'#E9EFEB'}}>{canAdd?<Pressable onPress={()=>setMenuForm({id:null,label:'',node_type:nextType,parent_id:item.id,sort_order:String(menuItems.filter(m=>m.parent_id===item.id).length*10+10),is_active:true,destination_type:'category',destination_value:''})} style={[s.smallAction,{backgroundColor:'#EAF5EE',borderColor:'#CFE2D7'}]}><Text style={s.smallActionText}>＋ Add {nextType}</Text></Pressable>:null}<Pressable onPress={()=>setMenuForm({id:item.id,label:item.label,node_type:type,parent_id:item.parent_id||'',sort_order:String(item.sort_order??0),is_active:!!item.is_active,destination_type:item.destination_type||'category',destination_value:item.destination_value||''})} style={s.smallAction}><Text style={s.smallActionText}>Edit</Text></Pressable><Pressable onPress={()=>deleteMenuItem(item)} style={s.smallAction}><Text style={[s.smallActionText,{color:'#B42318'}]}>Delete</Text></Pressable></View></View>})}
   {!menuItems.length?<Empty icon="git-network-outline" title="Start your storefront menu" detail="Create a main menu first, then use Add category and Add subcategory to build the hierarchy."/>:null}
  </View></>;

 if(page==='Categories')return <><PageHeader title="Categories" subtitle="Storefront navigation categories and product catalogue categories." onRefresh={loadData} loading={loading}/>
   <View style={s.panel}>
    <View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>Categories from Menu Management</Text><Text style={s.muted}>These are the categories customers see in your storefront menu.</Text></View><Pill label={`${menuItems.filter(m=>{const parent=menuItems.find(x=>x.id===m.parent_id);const type=m.node_type||(m.parent_id?(parent?.node_type==='category'?'subcategory':'category'):'menu');return type==='category';}).length} categories`}/></View>
    {menuItems.filter(m=>{const parent=menuItems.find(x=>x.id===m.parent_id);const type=m.node_type||(m.parent_id?(parent?.node_type==='category'?'subcategory':'category'):'menu');return type==='category';}).sort((x,y)=>Number(x.sort_order||0)-Number(y.sort_order||0)).map(c=>{const parent=menuItems.find(x=>x.id===c.parent_id);const children=menuItems.filter(x=>x.parent_id===c.id&&(x.node_type==='subcategory'||(!x.node_type&&menuItems.find(y=>y.id===x.parent_id)?.node_type==='category'))).sort((x,y)=>Number(x.sort_order||0)-Number(y.sort_order||0));return <View key={c.id} style={[s.listRow,{alignItems:'flex-start'}]}><View style={{width:34,height:34,borderRadius:10,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="folder-open-outline" size={18} color={GREEN}/></View><View style={{flex:1,gap:3}}><Text style={s.rowTitle}>{c.label}</Text><Text style={s.muted}>Under main menu: {parent?.label||'Not assigned'}</Text>{children.length?<Text style={{fontSize:12,color:MUTED}}>Subcategories: {children.map(x=>x.label).join(', ')}</Text>:<Text style={{fontSize:12,color:MUTED}}>No subcategories yet</Text>}</View><Pill label={c.is_active?'Visible':'Hidden'} danger={!c.is_active}/></View>;})}
    {!menuItems.some(m=>{const parent=menuItems.find(x=>x.id===m.parent_id);return (m.node_type||(m.parent_id?(parent?.node_type==='category'?'subcategory':'category'):'menu'))==='category';})?<Empty icon="folder-open-outline" title="No Menu Management categories yet" detail="Create a category under a main menu in Menu Management. It will appear here automatically after refresh."/>:null}
   </View>
   <View style={s.panel}>
    <View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>Product catalogue categories</Text><Text style={s.muted}>These categories are linked to products through category_id. They remain separate from storefront menu labels.</Text></View><Pill label={`${categories.length} records`}/></View>
    <View style={{borderWidth:1,borderColor:'#D7E8DD',backgroundColor:'#F8FBF9',borderRadius:12,padding:12,marginBottom:12,gap:9}}>
     <Text style={s.label}>Add a product catalogue category</Text>
     <View style={{flexDirection:'row',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}><View style={{flex:1,minWidth:180}}><Field label="Category name" value={newCategoryName} onChangeText={setNewCategoryName} placeholder="e.g. Skincare"/></View><View style={{paddingTop:20}}><Btn outline onPress={()=>uploadCategoryImage(null)} disabled={newCategoryImageBusy}>{newCategoryImageBusy?'Uploading…':newCategoryImageUrl?'Change image':'Choose image'}</Btn></View><View style={{paddingTop:20}}><Btn onPress={createCatalogueCategory} disabled={categorySaving||newCategoryImageBusy}>{categorySaving?'Saving…':'＋ Add category'}</Btn></View></View>
     {newCategoryImageUrl?<View style={{flexDirection:'row',alignItems:'center',gap:9,flexWrap:'wrap'}}><Image source={{uri:newCategoryImageUrl}} style={{width:48,height:48,borderRadius:24,backgroundColor:'#F1F5F2'}} resizeMode="cover"/><Text style={s.muted}>Image selected</Text><Btn outline onPress={()=>setNewCategoryImageUrl('')}>Remove image</Btn></View>:<Text style={s.muted}>Image is optional. If you deleted a category that still exists in Menu Management, you can also use the sync button in Products to recreate it.</Text>}
    </View>
    {categories.map(c=><View key={c.id} style={[s.listRow,{alignItems:'flex-start',flexWrap:'wrap'}]}>{c.image_url?<Image source={{uri:c.image_url}} style={{width:64,height:64,borderRadius:32,backgroundColor:'#F1F5F2'}} resizeMode="cover"/>:<View style={{width:64,height:64,borderRadius:32,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={23} color={GREEN}/></View>}<View style={{flex:1,minWidth:180,gap:6}}>{categoryEditId===c.id?<><Field label="Category name" value={categoryEditName} onChangeText={setCategoryEditName} placeholder="Category name"/><Pressable onPress={()=>setCategoryEditActive(v=>!v)} style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4}}><Ionicons name={categoryEditActive?'checkbox':'square-outline'} size={20} color={GREEN}/><Text style={s.muted}>{categoryEditActive?'Active — visible for assignment':'Inactive — hidden from assignment'}</Text></Pressable><View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}><Btn onPress={()=>saveCategoryEdits(c)} disabled={categorySaving}>{categorySaving?'Saving…':'Save changes'}</Btn><Btn outline onPress={()=>{setCategoryEditId(null);setCategoryEditName('');setError('');}}>Cancel</Btn></View></>:<><Text style={s.rowTitle}>{c.name}</Text><Text style={s.muted}>Product assignment category · {c.slug||'no slug'}</Text><View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}><Btn outline onPress={()=>beginCategoryEdit(c)}>Edit category</Btn><Btn outline onPress={()=>uploadCategoryImage(c.id)} disabled={categoryImageBusyId===c.id}>{categoryImageBusyId===c.id?'Uploading…':c.image_url?'Replace image':'Add image'}</Btn><Btn outline onPress={()=>deleteCategory(c)} disabled={categorySaving}>{categorySaving?'Working…':'Delete'}</Btn></View></>}</View><Pill label={categoryEditId===c.id?(categoryEditActive?'Active':'Inactive'):(c.is_active?'Active':'Inactive')} danger={categoryEditId===c.id?!categoryEditActive:!c.is_active}/></View>)}
    {!categories.length?<Empty icon="albums-outline" title="No product catalogue categories" detail="No records were returned from the product categories table. Menu Management categories are still listed above; product assignment categories are managed separately."/>:null}
   </View></>;
 if(page==='Inventory'){
  const inventorySearch=search.trim().toLowerCase();
  const inventoryProducts=products.filter(p=>`${p.name||''} ${p.sku||''} ${p.barcode||''} ${p.brand||''} ${p.categories?.name||categories.filter(c=>(p.category_ids||[p.category_id]).includes(c.id)).map(c=>c.name).join(' ')||categories.find(c=>c.id===p.category_id)?.name||''}`.toLowerCase().includes(inventorySearch)).slice().sort((a,b)=>Number(a.stock_quantity||0)-Number(b.stock_quantity||0));
  const totalUnits=products.reduce((sum,p)=>sum+Math.max(0,Number(p.stock_quantity||0)),0);
  const totalStoreValue=products.reduce((sum,p)=>sum+Math.max(0,Number(p.stock_quantity||0))*Math.max(0,Number(p.price_zmw||0)),0);
  const lowStock=products.filter(p=>Number(p.stock_quantity||0)>0&&Number(p.stock_quantity||0)<=Math.max(0,Number(p.low_stock_threshold??5))).length;
  return <><PageHeader title="Inventory" subtitle="Stock levels, product details, stock value and replenishment controls." onRefresh={loadData} loading={loading}/>
   <View style={s.metrics}>
    <Metric icon="cube-outline" label="Total product units" value={totalUnits.toLocaleString('en-ZM')} sub={`${products.length} catalogue products loaded`} color={BLUE}/>
    <Metric icon="wallet-outline" label="Total store amount" value={money(totalStoreValue)} sub="Estimated retail value of current stock" color={GREEN}/>
    <Metric icon="alert-circle-outline" label="Out of stock" value={products.filter(p=>Number(p.stock_quantity||0)<=0).length} sub="Needs replenishment" color="#B42318"/>
    <Metric icon="warning-outline" label="Low stock" value={lowStock} sub="At or below each product's threshold" color="#8A6D19"/>
    <Metric icon="checkmark-circle-outline" label="Available products" value={products.filter(p=>p.is_active&&Number(p.stock_quantity||0)>0).length} sub="Active and in stock"/>
   </View>
   <View style={s.panel}>
    <View style={s.panelHead}><View style={{flex:1}}><Text style={s.panelTitle}>Inventory register</Text><Text style={s.muted}>Search products and manage quantities or product details without leaving inventory.</Text></View><Pill label={`${inventoryProducts.length} shown`}/></View>
    <Field label="Search inventory" value={search} onChangeText={setSearch} placeholder="Name, SKU, brand or category"/>
    {inventoryProducts.length?inventoryProducts.map(p=>{
      const qty=Math.max(0,Number(p.stock_quantity||0));
      const threshold=Math.max(0,Number(p.low_stock_threshold??5));
      const stockStatus=qty<=0?'Out of stock':qty<=threshold?'Low stock':'In stock';
      const categoryName=p.categories?.name||categories.find(c=>c.id===p.category_id)?.name||'Uncategorised';
      const value=qty*Math.max(0,Number(p.price_zmw||0));
      return <View key={p.id} style={{paddingVertical:14,borderBottomWidth:1,borderColor:'#EEF2EF',gap:10}}>
       <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
        {p.image_url?<Image source={{uri:p.image_url}} resizeMode="contain" style={{width:68,height:68,borderRadius:10,borderWidth:1,borderColor:LINE,backgroundColor:'#F8FBF9'}}/>:<View style={{width:68,height:68,borderRadius:10,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="medkit-outline" size={27} color={GREEN}/></View>}
        <View style={{flex:1,minWidth:0,gap:3}}><Text style={s.rowTitle}>{p.name}</Text><Text style={s.muted}>SKU: {p.sku||'—'} · Category: {categoryName}</Text><Text style={s.muted}>Brand: {p.brand||'—'} · Price: {money(p.price_zmw)} · Stock value: {money(value)}</Text><Text style={s.muted}>Expiry: {p.expiry_date?new Date(`${p.expiry_date}T00:00:00`).toLocaleDateString():'Not recorded'} · Threshold: {threshold} units</Text><View style={{flexDirection:'row',alignItems:'center',gap:7,flexWrap:'wrap',marginTop:3}}><Pill label={stockStatus} danger={qty===0||qty<=threshold}/><Pill label={p.is_active?'Active':'Paused'} danger={!p.is_active}/>{p.requires_prescription?<Pill label="Prescription required"/>:null}</View></View>
        <View style={{alignItems:'flex-end',gap:3}}><Text style={[s.rowTitle,{fontSize:16,color:qty<=threshold?'#B42318':GREEN}]}>{qty.toLocaleString('en-ZM')}</Text><Text style={s.muted}>units</Text></View>
       </View>
       <View style={s.actions}>
        <Pressable disabled={busy||qty<=0} onPress={()=>adjustInventoryStock(p,-1)} style={[s.smallAction,{flexDirection:'row',alignItems:'center',gap:4,opacity:busy||qty<=0?.45:1}]}><Ionicons name="remove" size={14} color={GREEN}/><Text style={s.smallActionText}>1 unit</Text></Pressable>
        <Pressable disabled={busy} onPress={()=>adjustInventoryStock(p,1)} style={[s.smallAction,{flexDirection:'row',alignItems:'center',gap:4,opacity:busy?.45:1}]}><Ionicons name="add" size={14} color={GREEN}/><Text style={s.smallActionText}>Add 1</Text></Pressable>
        <Pressable onPress={()=>editInventoryProduct(p)} style={s.smallAction}><Text style={s.smallActionText}>Edit details</Text></Pressable>
        <Pressable disabled={busy} onPress={()=>toggleProductPause(p)} style={s.smallAction}><Text style={s.smallActionText}>{p.is_active?'Pause product':'Resume product'}</Text></Pressable>
       </View>
      </View>;
    }):<Empty icon="file-tray-outline" title="No matching inventory products" detail="Try another product name, SKU, brand or category."/>}
   </View>
   <Text style={s.muted}>Store amount is an estimate using current stock quantity × selling price. It is not purchase-cost valuation or accounting profit. Totals reflect the products currently returned to this admin screen.</Text>
  </>;
 }
 if(page==='Prescriptions')return <><PageHeader title="Prescriptions & lab results" subtitle="Select a submission to view its details and review actions." onRefresh={loadHealthDocuments} loading={loading}/><View style={[s.notice,{paddingVertical:10}]}><Ionicons name="shield-checkmark-outline" size={21} color={GREEN}/><View style={{flex:1}}><Text style={s.rowTitle}>Confidential health documents</Text><Text style={s.muted}>Private files · Review clinical information only within your professional scope.</Text></View></View><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:12}}>{[['all','All'],['submitted','New'],['in_review','In review'],['feedback_sent','Feedback sent'],['completed','Completed'],['needs_information','Needs information']].map(([v,label])=><Pressable key={v} onPress={()=>setHealthDocFilter(v)} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:9,borderWidth:1,borderColor:healthDocFilter===v?GREEN:LINE,backgroundColor:healthDocFilter===v?'#EAF5EE':'#fff'}}><Text style={{fontSize:12,fontWeight:'800',color:healthDocFilter===v?GREEN:MUTED}}>{label}</Text></Pressable>)}</View>{healthDocuments.filter(d=>healthDocFilter==='all'||d.status===healthDocFilter).length===0?<Empty icon="document-text-outline" title="No documents in this view" detail="Customer prescription and lab-result uploads will appear here once submitted."/>:healthDocuments.filter(d=>healthDocFilter==='all'||d.status===healthDocFilter).map(doc=>{
 return <HealthDocumentRow key={doc.id} doc={doc} expanded={expandedHealthDocumentId===doc.id} onToggle={()=>setExpandedHealthDocumentId(prev=>prev===doc.id?null:doc.id)} onOpen={()=>openHealthDocument(doc)} feedback={healthDocFeedback[doc.id]??''} onFeedbackChange={v=>setHealthDocFeedback(prev=>({...prev,[doc.id]:v}))} onStatusChange={v=>updateHealthDocument(doc,v)} busy={healthDocBusyId===doc.id} messages={healthDocMessages[doc.id]||[]} onSendReply={()=>sendHealthDocumentReply(doc)} onToggleClosed={closed=>setHealthConversationClosed(doc,closed)} sending={healthDocSendingId===doc.id}/>;
 })}</>;
 if(page==='Customers')return <><PageHeader title="Customers" subtitle="Registered customer profiles." onRefresh={loadData} loading={loading}/><Field label="Search customers" value={search} onChangeText={setSearch}/>{customers.filter(c=>`${c.full_name||''} ${c.phone||''}`.toLowerCase().includes(search.toLowerCase())).map(c=><View key={c.user_id} style={s.listRow}><View style={{flex:1}}><Text style={s.rowTitle}>{c.full_name||'Customer'}</Text><Text style={s.muted}>{c.phone||'No phone added'}</Text></View><Text style={s.muted}>{c.created_at?new Date(c.created_at).toLocaleDateString():''}</Text></View>)}</>;
 if(page==='Reports')return <><PageHeader title="Reports" subtitle="High-level operational totals from loaded records." onRefresh={loadData} loading={loading}/><View style={s.metrics}><Metric icon="receipt-outline" label="Orders loaded" value={stats.orders} sub="Latest 100 orders"/><Metric icon="cash-outline" label="Confirmed revenue" value={money(stats.revenue)} sub="Paid/completed/delivered only" color={BLUE}/><Metric icon="cart-outline" label="Average confirmed order" value={money(stats.orders?stats.revenue/Math.max(1,orders.filter(x=>['paid','completed','delivered'].includes(String(x.status).toLowerCase())).length):0)} sub="Based on loaded records"/></View><Text style={s.muted}>This is an operational summary, not an accounting ledger. A full sales report needs payment reconciliation and date-filtered server queries.</Text></>;
 if(page==='Login Branding')return <><PageHeader title="Login & registration branding" subtitle="These settings control the storefront header plus the shared customer login and account-creation popup."/><View style={s.panel}><Text style={s.panelTitle}>Brand identity</Text><Field label="Pharmacy title" value={branding.pharmacy_title} onChangeText={v=>setBranding({...branding,pharmacy_title:v})}/><Field label="Tagline" value={branding.tagline} onChangeText={v=>setBranding({...branding,tagline:v})}/>
<Text style={s.panelTitle}>Title and tagline text appearance</Text>
<AppearancePicker label="Pharmacy title colour" value={branding.brand_title_color} onChange={v=>setBranding({...branding,brand_title_color:v})}/><AppearancePicker label="Pharmacy title font family" kind="font" value={branding.brand_title_font_family} onChange={v=>setBranding({...branding,brand_title_font_family:v})}/><AppearancePicker label="Tagline colour" value={branding.tagline_color} onChange={v=>setBranding({...branding,tagline_color:v})}/><AppearancePicker label="Tagline font family" kind="font" value={branding.tagline_font_family} onChange={v=>setBranding({...branding,tagline_font_family:v})}/>{[['Pharmacy title size (px)','brand_title_size'],['Pharmacy title font style (normal/bold/italic)','brand_title_style'],['Tagline size (px)','tagline_size'],['Tagline font style (normal/bold/italic)','tagline_style']].map(([label,key])=><Field key={key} label={label} value={String(branding[key]??'')} onChangeText={v=>setBranding({...branding,[key]:key.endsWith('_size')?(Number(v)||10):v})} keyboardType={key.endsWith('_size')?'number-pad':'default'}/>)}
<BrandImageControl label="Header / storefront logo" field="header_logo_url"/><BrandImageControl label="Left-panel logo" field="logo_left_url"/><BrandImageControl label="Form-panel logo" field="logo_form_url"/><Text style={s.muted}>Choose each logo directly from your computer or phone. Blank logo fields use the official app logo.</Text></View><View style={s.panel}><Text style={s.panelTitle}>Green panel appearance</Text><Field label="Background colour (hex)" value={branding.left_background_color} onChangeText={v=>setBranding({...branding,left_background_color:v})} placeholder="#0B4B38"/><BrandImageControl label="Green panel background image (optional)" field="left_background_image_url"/><Field label="Main heading" value={branding.left_heading} onChangeText={v=>setBranding({...branding,left_heading:v})}/>
<AppearancePicker label="Heading colour" value={branding.left_heading_color} onChange={v=>setBranding({...branding,left_heading_color:v})}/><AppearancePicker label="Heading font family" kind="font" value={branding.left_heading_font_family} onChange={v=>setBranding({...branding,left_heading_font_family:v})}/>{[['Heading size (px)','left_heading_size'],['Heading font style (normal/bold/italic)','left_heading_style']].map(([label,key])=><Field key={key} label={label} value={String(branding[key]??'')} onChangeText={v=>setBranding({...branding,[key]:key.endsWith('_size')?(Number(v)||29):v})} keyboardType={key.endsWith('_size')?'number-pad':'default'}/>)}
<Field label="Description" value={branding.left_description} onChangeText={v=>setBranding({...branding,left_description:v})}/>
<AppearancePicker label="Description colour" value={branding.left_description_color} onChange={v=>setBranding({...branding,left_description_color:v})}/><AppearancePicker label="Description font family" kind="font" value={branding.left_description_font_family} onChange={v=>setBranding({...branding,left_description_font_family:v})}/>{[['Description size (px)','left_description_size'],['Description font style (normal/bold/italic)','left_description_style']].map(([label,key])=><Field key={key} label={label} value={String(branding[key]??'')} onChangeText={v=>setBranding({...branding,[key]:key.endsWith('_size')?(Number(v)||13):v})} keyboardType={key.endsWith('_size')?'number-pad':'default'}/>)}
<Field label="Benefit line 1" value={branding.benefit_one} onChangeText={v=>setBranding({...branding,benefit_one:v})}/><Field label="Benefit line 2" value={branding.benefit_two} onChangeText={v=>setBranding({...branding,benefit_two:v})}/><Field label="Benefit line 3" value={branding.benefit_three} onChangeText={v=>setBranding({...branding,benefit_three:v})}/>
<AppearancePicker label="Benefit text colour" value={branding.benefit_color} onChange={v=>setBranding({...branding,benefit_color:v})}/><AppearancePicker label="Benefit font family" kind="font" value={branding.benefit_font_family} onChange={v=>setBranding({...branding,benefit_font_family:v})}/><AppearancePicker label="Welcome label colour" value={branding.right_eyebrow_color} onChange={v=>setBranding({...branding,right_eyebrow_color:v})}/><AppearancePicker label="Welcome label font family" kind="font" value={branding.right_eyebrow_font_family} onChange={v=>setBranding({...branding,right_eyebrow_font_family:v})}/><AppearancePicker label="Right heading colour" value={branding.right_heading_color} onChange={v=>setBranding({...branding,right_heading_color:v})}/><AppearancePicker label="Right heading font family" kind="font" value={branding.right_heading_font_family} onChange={v=>setBranding({...branding,right_heading_font_family:v})}/><AppearancePicker label="Right intro colour" value={branding.right_intro_color} onChange={v=>setBranding({...branding,right_intro_color:v})}/><AppearancePicker label="Right intro font family" kind="font" value={branding.right_intro_font_family} onChange={v=>setBranding({...branding,right_intro_font_family:v})}/>{[['Benefit text size (px)','benefit_size'],['Benefit font style (normal/bold/italic)','benefit_style'],['Welcome label size (px)','right_eyebrow_size'],['Welcome label font style (normal/bold/italic)','right_eyebrow_style'],['Right heading size (px)','right_heading_size'],['Right heading font style (normal/bold/italic)','right_heading_style'],['Right intro size (px)','right_intro_size'],['Right intro font style (normal/bold/italic)','right_intro_style']].map(([label,key])=><Field key={key} label={label} value={String(branding[key]??'')} onChangeText={v=>setBranding({...branding,[key]:key.endsWith('_size')?(Number(v)||12):v})} keyboardType={key.endsWith('_size')?'number-pad':'default'}/>)}
<View style={{height:6}}/><View style={{backgroundColor:branding.left_background_color||GREEN,borderRadius:12,padding:18,gap:7}}><Text style={{fontSize:Number(branding.left_heading_size)||19,fontFamily:branding.left_heading_font_family==='System'?undefined:branding.left_heading_font_family,fontWeight:branding.left_heading_style==='normal'?'400':'900',fontStyle:branding.left_heading_style==='italic'?'italic':'normal',color:branding.left_heading_color||'#FFFFFF',textAlign:'center'}}>{branding.left_heading||branding.pharmacy_title}</Text><Text style={{fontSize:Number(branding.left_description_size)||12,fontFamily:branding.left_description_font_family==='System'?undefined:branding.left_description_font_family,fontWeight:branding.left_description_style==='bold'?'700':'400',fontStyle:branding.left_description_style==='italic'?'italic':'normal',lineHeight:18,color:branding.left_description_color||'#E4F2EB',textAlign:'center'}}>{branding.left_description}</Text><Text style={{fontSize:11,color:'#FFFFFF'}}>✓ {branding.benefit_one}</Text><Text style={{fontSize:11,color:'#FFFFFF'}}>✓ {branding.benefit_two}</Text><Text style={{fontSize:11,color:'#FFFFFF'}}>✓ {branding.benefit_three}</Text></View><Btn onPress={saveBranding} disabled={brandingSaving}>{brandingSaving?'Saving branding…':'Save login branding'}</Btn></View><View style={s.notice}><Ionicons name="information-circle-outline" size={22} color={GREEN}/><View style={{flex:1}}><Text style={s.rowTitle}>Shared login and registration</Text><Text style={s.muted}>Both sign-in and create-account modes use the same saved branding. Customer role handling and staff email verification remain separate from visual settings. This panel changes appearance only, not permissions.</Text></View></View></>;
 return <><PageHeader title="Settings" subtitle="Portal access and pharmacy configuration."/><View style={s.panel}><Text style={s.panelTitle}>Signed-in administrator</Text><Text style={s.rowTitle}>{session.user.email}</Text><Text style={s.muted}>Role: {role}</Text><Text style={s.muted}>Account services: {supabaseConfigured?'Connected':'Unavailable'}</Text><View style={{height:12}}/><Btn outline onPress={async()=>{await supabase.auth.signOut();setSession(null);setRole('');}}>Sign out</Btn></View><View style={s.notice}><Ionicons name="lock-closed-outline" size={22} color={GREEN}/><View style={{flex:1}}><Text style={s.rowTitle}>Security note</Text><Text style={s.muted}>Sensitive product changes, order updates, prescription reviews and payment actions must be checked by secure server-side permissions. Never expose private server credentials in the app.</Text></View></View></>;
 };
 return <SafeAreaView style={s.root}><View style={[s.topbar,{paddingHorizontal:desktop?28:14}]}><View style={s.brandIconSmall}><Ionicons name="leaf" size={22} color={LIME}/></View><View style={{flex:1}}><Text style={s.brand}>Kanev Pharmacy</Text><Text style={s.brandSub}>Administration</Text></View><View style={s.roleBadge}><Text style={s.roleText}>{role}</Text></View><Pressable onPress={loadData} style={s.refreshIcon}><Ionicons name="refresh" size={19} color={GREEN}/></Pressable></View><View style={[s.body,desktop&&{flexDirection:'row'}]}>{desktop?<View style={s.sidebar}><Text style={s.sideLabel}>WORKSPACE</Text>{menu.map(([label,icon])=><NavItem key={label} label={label} icon={icon} badge={label==='Prescriptions'?healthDocuments.filter(d=>String(d.status||'submitted').toLowerCase()==='submitted').length:0} active={page===label} onPress={()=>{setPage(label);setSearch('');}}/>)}<View style={{flex:1}}/><Text style={s.sideFooter}>Closer to Your Health</Text></View>:<ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mobileNav}>{menu.map(([label,icon])=><Pressable key={label} onPress={()=>setPage(label)} style={[s.mobileNavItem,page===label&&s.mobileNavActive]}><Ionicons name={icon} size={17} color={page===label?GREEN:MUTED}/><Text style={[s.mobileNavText,page===label&&{color:GREEN}]}>{label}</Text>{label==='Prescriptions'&&healthDocuments.some(d=>String(d.status||'submitted').toLowerCase()==='submitted')?<View style={{marginLeft:4,minWidth:18,height:18,paddingHorizontal:5,borderRadius:9,backgroundColor:LIME,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:10,fontWeight:'900',color:GREEN}}>{healthDocuments.filter(d=>String(d.status||'submitted').toLowerCase()==='submitted').length}</Text></View>:null}</Pressable>)}</ScrollView>}<ScrollView style={s.mainScroll} contentContainerStyle={[s.mainContent,{padding:desktop?28:15,maxWidth:desktop?1450:900,alignSelf:'stretch'}]}>{content()}</ScrollView></View><KanevNoticeModal visible={!!error} title={error && /saved successfully|saved\.|uploaded\./i.test(error)?'Update complete':'Something needs attention'} message={error} tone={error && /saved successfully|saved\.|uploaded\./i.test(error)?'success':'error'} onClose={()=>setError('')}/>
 <Modal visible={!!documentPreview} animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>setDocumentPreview(null)}>
  <SafeAreaView style={{flex:1,backgroundColor:'#F4F8F5'}}>
   <View style={{height:58,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderColor:LINE,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:12}}>
    <Pressable onPress={()=>setDocumentPreview(null)} style={{width:38,height:38,borderRadius:10,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="arrow-back" size={21} color={GREEN}/></Pressable>
    <View style={{flex:1}}><Text numberOfLines={1} style={{fontSize:14,fontWeight:'900',color:INK}}>{documentPreview?.title||'Health document'}</Text><Text style={{fontSize:11,color:MUTED}}>Private document preview</Text></View>
    <Pressable onPress={()=>setDocumentPreview(null)}><Ionicons name="close" size={23} color={GREEN}/></Pressable>
   </View>
   {documentPreviewLoading||!documentPreview?.url?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><ActivityIndicator size="large" color={GREEN}/><Text style={{color:MUTED}}>Opening secure document…</Text></View>:Platform.OS==='web'?(
    (String(documentPreview.mime||'').startsWith('image/')||/\.(png|jpe?g|webp)(\?|$)/i.test(documentPreview.title||''))?
      <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:12}}><Image source={{uri:documentPreview.url}} resizeMode="contain" style={{width:'100%',height:'100%'}} /></View>:
      React.createElement('iframe',{title:documentPreview.title||'Private health document',src:documentPreview.url,style:{width:'100%',height:'100%',border:0,background:'#F4F8F5'},allow:'fullscreen'})
   ):<WebView source={{uri:documentPreview.url}} style={{flex:1,backgroundColor:'#F4F8F5'}} originWhitelist={['*']} allowsInlineMediaPlayback startInLoadingState renderLoading={()=><ActivityIndicator size="large" color={GREEN}/>}/>}
  </SafeAreaView>
 </Modal>
 </SafeAreaView>;
}
function HealthDocumentRow({doc,expanded,onToggle,onOpen,feedback,onFeedbackChange,onStatusChange,busy,messages=[],onSendReply,onToggleClosed,sending}) {
 const status=String(doc.status||'submitted').toLowerCase(), terminal=status==='completed', closed=!!doc.conversation_closed_at;
 const actions=[['in_review','Mark in review'],['feedback_sent','Send feedback'],['completed','Complete'],['needs_information','Request more info']];
 const submitted=doc.created_at?new Date(doc.created_at):null;
 const dateLabel=submitted&&!Number.isNaN(submitted.getTime())?submitted.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Submission time unavailable';
 return <View style={[s.panel,{padding:0,overflow:'hidden',backgroundColor:terminal?'#FFFFFF':'#EEF1EF',borderColor:terminal?LINE:'#D8DEDA'}]}>
  <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{expanded}} style={{paddingHorizontal:16,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:terminal?'#FFFFFF':'#EEF1EF'}}>
   <View style={{width:38,height:38,borderRadius:10,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name={doc.document_type==='prescription'?'document-text-outline':'flask-outline'} size={20} color={GREEN}/></View>
   <View style={{flex:1,minWidth:0,gap:4}}><Text style={s.rowTitle}>{healthDocumentNumber(doc)}</Text><Text style={s.muted}>{dateLabel}</Text></View>
   <Pill label={status.replaceAll('_',' ')}/><Ionicons name={expanded?'chevron-up':'chevron-down'} size={19} color={GREEN}/>
  </Pressable>
  {expanded?<View style={{paddingHorizontal:16,paddingBottom:16,borderTopWidth:1,borderColor:LINE,gap:10,paddingTop:14,backgroundColor:'#FFFFFF'}}>
   {doc.title?<Text style={s.muted}>Title: {doc.title}</Text>:null}{doc.notes?<Text style={s.muted}>Customer note: {doc.notes}</Text>:null}
   <Btn outline onPress={onOpen}>Open private document</Btn>
   <View style={{padding:12,borderRadius:12,backgroundColor:'#F7FAF8',borderWidth:1,borderColor:LINE,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}><View style={{flexDirection:'row',alignItems:'center',gap:7,flex:1}}><Ionicons name="chatbubbles-outline" size={18} color={GREEN}/><Text style={{fontSize:13,fontWeight:'900',color:INK}}>Conversation with customer</Text></View><Pill label={closed?'Closed':'Open'}/></View>
    {messages.length===0?<Text style={s.muted}>No messages yet. Send feedback to start the conversation.</Text>:<View style={{gap:9}}>{messages.map(m=>{const fromAdmin=m.sender_role==='admin';return <View key={m.id} style={{alignSelf:fromAdmin?'flex-end':'flex-start',maxWidth:'92%',padding:10,borderRadius:12,backgroundColor:fromAdmin?'#DDF4E6':'#FFFFFF',borderWidth:1,borderColor:fromAdmin?'#C2E4D0':LINE}}><Text style={{fontSize:10,fontWeight:'900',color:GREEN,marginBottom:4}}>{fromAdmin?'KANEV PHARMACY':'CUSTOMER'}</Text><Text style={{fontSize:12,color:INK,lineHeight:18}}>{m.message}</Text><Text style={{fontSize:10,color:MUTED,marginTop:5}}>{new Date(m.created_at).toLocaleString()}</Text></View>;})}</View>}
    {closed?<Text style={{fontSize:11,color:MUTED,lineHeight:16}}>The customer cannot reply while closed. Reopen the conversation to continue.</Text>:null}
    <Field label="Message to customer" value={feedback} onChangeText={onFeedbackChange} placeholder="Write feedback or a reply…"/>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Btn outline disabled={sending||closed||!String(feedback||'').trim()} onPress={onSendReply}>{sending?'Sending…':'Send feedback / reply'}</Btn><Btn outline disabled={busy||sending} onPress={()=>onToggleClosed(!closed)}>{closed?'Reopen conversation':'Close conversation'}</Btn></View>
   </View>
   <Text style={{fontSize:11,color:MUTED}}>Status actions</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{actions.map(([value,label])=>{const current=value===status;return <Btn key={value} outline onPress={()=>onStatusChange(value)} disabled={busy||terminal||current}>{busy?'Saving…':current?`${label} ✓`:label}</Btn>;})}</View>
   {doc.reviewed_at?<Text style={s.muted}>Last reviewed {new Date(doc.reviewed_at).toLocaleString()}</Text>:null}
  </View>:null}
 </View>;
}

function NavItem({label,icon,active,onPress,badge=0}){return <Pressable onPress={onPress} style={[s.navItem,active&&s.navItemActive]}><Ionicons name={icon} size={19} color={active?GREEN:'#809188'}/><Text style={[s.navText,active&&{color:GREEN,fontWeight:'800'}]}>{label}</Text>{badge>0?<View style={{marginLeft:'auto',minWidth:21,height:21,paddingHorizontal:6,borderRadius:11,backgroundColor:LIME,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:11,fontWeight:'900',color:GREEN}}>{badge>99?'99+':badge}</Text></View>:null}{active?<View style={s.activeBar}/>:null}</Pressable>}
function PageHeader({title,subtitle,onRefresh,loading}){return <View style={s.pageHead}><View style={{flex:1}}><Text style={s.pageTitle}>{title}</Text><Text style={s.muted}>{subtitle}</Text></View>{onRefresh?<Btn outline onPress={onRefresh}>{loading?'Refreshing…':'↻ Refresh'}</Btn>:null}</View>}
function AdminOrderProgress({status,fulfilment}) {
 const normalized=String(status||'pending_review').toLowerCase();
 const steps=['pending_review','confirmed','preparing',fulfilment==='collection'?'ready_for_collection':'out_for_delivery','completed'];
 const labels=['Received','Confirmed','Preparing',fulfilment==='collection'?'Ready for collection':'Out for delivery',fulfilment==='collection'?'Collected':'Delivered'];
 const cancelled=normalized==='cancelled'; const idx=steps.indexOf(normalized); const pct=cancelled?0:normalized==='completed'?100:Math.round(Math.max(0,idx)/(steps.length-1)*100);
 const size=54,stroke=6,r=(size-stroke)/2,circ=2*Math.PI*r;
 return <View style={{flexDirection:'row',alignItems:'center',gap:9,marginTop:8,padding:9,borderRadius:10,backgroundColor:'#F4F8F5',borderWidth:1,borderColor:'#DCE8E1'}}><View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}><Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><Circle cx={size/2} cy={size/2} r={r} stroke="#DCE8E1" strokeWidth={stroke} fill="none"/><Circle cx={size/2} cy={size/2} r={r} stroke={cancelled?'#B42318':'#064E3B'} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={circ*(1-pct/100)} rotation="-90" origin={`${size/2}, ${size/2}`}/></Svg><Text style={{position:'absolute',fontSize:12,fontWeight:'900',color:cancelled?'#B42318':'#064E3B'}}>{cancelled?'—':`${pct}%`}</Text></View><View style={{flex:1,gap:3}}><Text style={{fontSize:11,fontWeight:'800',color:'#687A72'}}>CUSTOMER PROGRESS</Text><Text style={{fontSize:13,fontWeight:'900',color:cancelled?'#B42318':'#064E3B'}}>{cancelled?'Cancelled':labels[Math.max(0,idx)]||String(status||'Pending').replaceAll('_',' ')}</Text><View style={{height:4,backgroundColor:'#DCE8E1',borderRadius:4,overflow:'hidden'}}><View style={{height:4,width:`${pct}%`,backgroundColor:'#C8F36A'}}/></View></View></View>;
}
function OrderRow({item}){return <View style={s.orderRow}><View style={s.orderIcon}><Ionicons name="receipt-outline" size={19} color={GREEN}/></View><View style={{flex:1,minWidth:0}}><Text style={s.rowTitle}>{item.order_number||`Order ${String(item.id).slice(0,8)}`}</Text><Text style={s.muted} numberOfLines={1}>{item.customer_name||'Customer'} · {item.customer_phone||'No phone'}</Text><Text style={s.muted}>{item.created_at?new Date(item.created_at).toLocaleString():''}</Text><Text style={s.muted}>Fulfilment: {String(item.fulfilment||'not specified').replaceAll('_',' ')}</Text>{item.delivery_address?<Text style={s.muted} numberOfLines={2}>Address: {item.delivery_address}</Text>:null}{item.delivery_notes?<Text style={s.muted} numberOfLines={2}>Instructions: {item.delivery_notes}</Text>:null}{item.tracking_code?<Text style={[s.muted,{color:GREEN,fontWeight:'800'}]}>Tracking: {item.tracking_code}</Text>:null}{item.delivery_partner?<Text style={s.muted}>Courier: {item.delivery_partner}</Text>:null}</View><View style={{alignItems:'flex-end',gap:5}}><Text style={s.rowTitle}>{money(item.total_zmw)}</Text><Pill label={item.delivery_status||item.status||'pending'} danger={['cancelled','failed'].includes(String(item.status).toLowerCase())}/></View></View>}
function Pill({label,danger=false}){return <View style={[s.pill,danger&&s.pillDanger]}><Text style={[s.pillText,danger&&{color:'#B42318'}]}>{label}</Text></View>}
function Empty({icon,title,detail}){return <View style={s.empty}><Ionicons name={icon} size={28} color="#789188"/><Text style={s.rowTitle}>{title}</Text><Text style={[s.muted,{textAlign:'center'}]}>{detail}</Text></View>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:BG},center:{flex:1,backgroundColor:BG,alignItems:'center',justifyContent:'center',gap:12},loginWrap:{flex:1,backgroundColor:BG,alignItems:'center',justifyContent:'center',padding:20},loginCard:{width:'100%',maxWidth:460,backgroundColor:'#fff',padding:26,borderRadius:22,borderWidth:1,borderColor:LINE},brandIcon:{width:52,height:52,borderRadius:16,backgroundColor:GREEN,alignItems:'center',justifyContent:'center',marginBottom:18},eyebrow:{fontSize:11,letterSpacing:2,fontWeight:'900',color:GREEN},loginTitle:{fontSize:30,fontWeight:'900',color:INK,marginTop:6,marginBottom:6},muted:{fontSize:13,color:MUTED,lineHeight:19,marginTop:3},label:{fontSize:12,fontWeight:'800',color:INK},input:{height:45,borderWidth:1,borderColor:LINE,borderRadius:10,paddingHorizontal:12,color:INK,backgroundColor:'#fff',fontSize:14},btn:{minHeight:42,paddingHorizontal:16,borderRadius:10,backgroundColor:GREEN,alignItems:'center',justifyContent:'center'},btnOutline:{backgroundColor:'#fff',borderWidth:1,borderColor:LINE},btnText:{fontSize:13,fontWeight:'800',color:'#fff'},error:{backgroundColor:'#FFF0EF',borderColor:'#F2B7B1',borderWidth:1,color:'#A52A20',padding:11,borderRadius:10,marginVertical:10,fontSize:12},errorText:{color:'#A52A20',fontSize:12,lineHeight:18},topbar:{height:70,backgroundColor:'#fff',borderBottomWidth:1,borderColor:LINE,flexDirection:'row',alignItems:'center',gap:12},brandIconSmall:{width:40,height:40,borderRadius:12,backgroundColor:GREEN,alignItems:'center',justifyContent:'center'},brand:{fontSize:16,fontWeight:'900',color:GREEN},brandSub:{fontSize:11,color:MUTED,marginTop:2},roleBadge:{backgroundColor:'#EAF5EE',borderRadius:30,paddingHorizontal:11,paddingVertical:7},roleText:{fontSize:11,fontWeight:'900',color:GREEN,textTransform:'capitalize'},refreshIcon:{width:38,height:38,borderRadius:11,backgroundColor:BG,alignItems:'center',justifyContent:'center'},body:{flex:1},sidebar:{width:225,backgroundColor:'#fff',borderRightWidth:1,borderColor:LINE,padding:15},sideLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:'#95A49C',marginHorizontal:10,marginTop:13,marginBottom:12},navItem:{height:44,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:12,borderRadius:10,marginBottom:4,position:'relative'},navItemActive:{backgroundColor:'#EAF5EE'},navText:{fontSize:13,color:'#61736A',fontWeight:'600'},activeBar:{position:'absolute',left:0,top:9,bottom:9,width:3,backgroundColor:GREEN,borderRadius:3},sideFooter:{fontSize:11,color:MUTED,padding:10},mobileNav:{maxHeight:61,backgroundColor:'#fff',borderBottomWidth:1,borderColor:LINE,flexGrow:0},mobileNavItem:{paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:7,margin:7,borderRadius:10,borderWidth:1,borderColor:'transparent'},mobileNavActive:{backgroundColor:'#EAF5EE',borderColor:'#D6E8DB'},mobileNavText:{fontSize:12,color:MUTED,fontWeight:'700'},mainScroll:{flex:1},mainContent:{width:'100%',gap:15},pageHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:5},pageTitle:{fontSize:25,fontWeight:'900',color:INK,letterSpacing:-.5},metrics:{flexDirection:'row',flexWrap:'wrap',gap:12},metric:{flexGrow:1,flexBasis:190,minWidth:145,backgroundColor:'#fff',borderWidth:1,borderColor:LINE,borderRadius:16,padding:17},metricIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',marginBottom:12},metricLabel:{fontSize:12,color:MUTED,fontWeight:'700'},metricValue:{fontSize:25,fontWeight:'900',color:INK,marginTop:5},metricSub:{fontSize:11,color:MUTED,marginTop:5},panel:{backgroundColor:'#fff',borderWidth:1,borderColor:LINE,borderRadius:16,padding:17,gap:12},panelHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},panelTitle:{fontSize:16,fontWeight:'900',color:INK,marginBottom:2},link:{fontSize:12,fontWeight:'800',color:GREEN},orderRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:9},orderIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'},rowTitle:{fontSize:13,fontWeight:'800',color:INK},pill:{backgroundColor:'#EAF5EE',paddingHorizontal:8,paddingVertical:4,borderRadius:20},pillDanger:{backgroundColor:'#FFF0EF'},pillText:{fontSize:10,fontWeight:'800',color:GREEN,textTransform:'capitalize'},listRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,borderBottomWidth:1,borderColor:'#EEF2EF'},actions:{flexDirection:'row',flexWrap:'wrap',gap:6,borderTopWidth:1,borderColor:'#EEF2EF',paddingTop:11},smallAction:{borderWidth:1,borderColor:LINE,borderRadius:8,paddingVertical:7,paddingHorizontal:9},smallActionText:{fontSize:11,fontWeight:'700',color:GREEN,textTransform:'capitalize'},formGrid:{flexDirection:'row',gap:12},empty:{alignItems:'center',justifyContent:'center',padding:24,gap:7},notice:{backgroundColor:'#EAF5EE',borderRadius:14,padding:15,flexDirection:'row',gap:12,alignItems:'flex-start'},linkText:{color:BLUE}});
