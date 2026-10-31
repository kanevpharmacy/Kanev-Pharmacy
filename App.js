import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaView, View, Text, TextInput, ScrollView, Pressable, Animated,
  Image as NativeImage, ImageBackground, StyleSheet, StatusBar, Platform, Modal, Linking, useWindowDimensions
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { PRODUCTS, CATEGORIES } from './src/data/products';
import { COLORS } from './src/theme';
import { supabase, supabaseConfigured } from './src/lib/supabase';
import KanevAdminPortal from './KanevAdminPortal';
import KanevPharmacySymbol from './assets/kanev-pharmacy-symbol.png';
import KanevNoticeModal from './src/components/KanevNoticeModal';

// Consistent image loading across web and native. Web images are lazy-loaded
// and decoded asynchronously; native images use progressive rendering and a
// short fade so scrolling catalogues do not block the first screen.
function Image({ loading, ...props }) {
  const webProps = Platform.OS === 'web'
    ? { loading: loading || 'lazy', decoding: 'async' }
    : { fadeDuration: 140, progressiveRenderingEnabled: true };
  return <NativeImage {...webProps} {...props} />;
}

// Mobile browsers already manage their own browser/system safe areas. Applying
// React Native's SafeAreaView to the web root can add large blank bands in
// browsers that report browser-chrome insets as page insets.
const AppSafeAreaView = Platform.OS === 'web' ? View : SafeAreaView;

const money = (amount) => `K${Number(amount).toFixed(2)}`;

// Request appropriately sized, compressed variants from Supabase Storage.
// Original files remain untouched; the browser downloads smaller derivatives.
// Keep the original public Storage URL. Image transformation endpoints are
// not guaranteed to be enabled on every Supabase project; rewriting object
// URLs can make otherwise valid product and category photos disappear.
const optimizedImageUrl = (url) => url;

// Each banner owns its own slideshow timer and selected transition effect.
// One image stays still; multiple images rotate at a relaxed 7-second interval.
function BannerImageSlideshow({ banner, style, resizeMode = 'cover', opacity = 1, showDots = true, initialIndex = 0 }) {
  const images = React.useMemo(() => {
    const list = Array.isArray(banner?.image_urls) ? banner.image_urls : [];
    return [...list, banner?.image_url].filter((url, index, all) => typeof url === 'string' && url.trim() && all.indexOf(url) === index);
  }, [banner?.image_urls, banner?.image_url]);
  const [index, setIndex] = useState(() => images.length ? ((initialIndex % images.length) + images.length) % images.length : 0);
  const progress = useRef(new Animated.Value(1)).current;
  const previousIndex = useRef(0);
  const effect = banner?.slideshow_effect || 'slide-left';

  useEffect(() => {
    const startIndex = images.length ? ((initialIndex % images.length) + images.length) % images.length : 0;
    setIndex(startIndex);
    previousIndex.current = startIndex;
    progress.setValue(1);
    if (images.length < 2) return undefined;
    const timer = setInterval(() => setIndex(current => (current + 1) % images.length), 7000);
    return () => clearInterval(timer);
  }, [images.length, banner?.id, progress, initialIndex]);

  useEffect(() => {
    if (previousIndex.current === index) return;
    previousIndex.current = index;
    // A single progress value drives the selected effect for a smooth, consistent transition.
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [index, effect, progress]);

  if (!images.length) return null;
  const translateX = effect === 'slide-left' ? progress.interpolate({inputRange:[0,1],outputRange:[44,0]}) : effect === 'slide-right' ? progress.interpolate({inputRange:[0,1],outputRange:[-44,0]}) : 0;
  const translateY = effect === 'slide-up' ? progress.interpolate({inputRange:[0,1],outputRange:[32,0]}) : 0;
  const scale = effect === 'zoom' ? progress.interpolate({inputRange:[0,1],outputRange:[1.12,1]}) : effect === 'pop' ? progress.interpolate({inputRange:[0,1],outputRange:[0.82,1]}) : 1;
  const imageOpacity = effect === 'fade' ? progress.interpolate({inputRange:[0,1],outputRange:[0,opacity]}) : progress.interpolate({inputRange:[0,1],outputRange:[opacity*0.72,opacity]});
  return <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }, style]}>
    <Animated.Image loading="eager" source={{ uri: optimizedImageUrl(images[index % images.length], 1400, 78, 'cover') }} resizeMode={banner?.image_fit || resizeMode} style={{ width: '100%', height: '100%', opacity:imageOpacity, transform:[{translateX},{translateY},{scale}] }} />
    {images.length > 1 && showDots ? <View style={{ position: 'absolute', bottom: 9, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>{images.map((_, i) => <View key={`${banner?.id || 'banner'}-dot-${i}`} style={{ width: i === index ? 17 : 6, height: 6, borderRadius: 4, backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,0.65)', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.18)' }} />)}</View> : null}
  </View>;
}
const healthDocumentNumber = (doc) => `${doc?.document_type === 'prescription' ? 'RX' : 'LAB'}-${doc?.created_at ? new Date(doc.created_at).toISOString().slice(0,10).replaceAll('-','') : 'DOC'}-${String(doc?.id || '').replace(/-/g,'').slice(0,6).toUpperCase() || 'NEW'}`;

const DEFAULT_LOGIN_BRANDING = {
  homepage_category_ids: [],
  loading_logo_url: '',
  pharmacy_title: 'Kanev Pharmacy', tagline: 'Closer to Your Health',
  logo_left_url: '', logo_form_url: '', header_logo_url: '', left_background_image_url: '',
  left_background_color: '#0B4B38', left_heading: 'Closer to your health.',
  left_description: 'Everyday essentials, trusted pharmacy care and a simpler way to look after your family.',
  benefit_one: 'Your account, handled securely', benefit_two: 'Keep track of your orders', benefit_three: 'Care for every day',left_heading_color:'#FFFFFF',left_heading_size:29,left_heading_style:'bold',left_description_color:'#D8EAE2',left_description_size:13,left_description_style:'normal',benefit_color:'#F2FBF5',benefit_size:12,benefit_style:'bold',brand_title_color:'#0B4B38',brand_title_size:15,brand_title_style:'bold',tagline_color:'#246EB0',tagline_size:10,tagline_style:'normal',right_eyebrow_color:'#16805B',right_eyebrow_size:10,right_eyebrow_style:'bold',right_heading_color:'#172B24',right_heading_size:18,right_heading_style:'bold',right_intro_color:'#718078',right_intro_size:12,right_intro_style:'normal',left_heading_font_family:'System',left_description_font_family:'System',benefit_font_family:'System',brand_title_font_family:'System',tagline_font_family:'System',right_eyebrow_font_family:'System',right_heading_font_family:'System',right_intro_font_family:'System',
};


function ActionButton({ title, onPress, secondary = false, disabled = false }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={[styles.actionButton, secondary && styles.secondaryButton, disabled && { opacity: 0.45 }]}>
      <Text style={[styles.actionButtonText, secondary && { color: COLORS.green }]}>{title}</Text>
    </Pressable>
  );
}

function ProductCard({ product, onAdd, onOpen, cardWidth = '19%', imageHeight = 145, imageResizeMode = 'contain', mobile = false, imageLoading = 'lazy' }) {
  const originalPrice = Number(product.original_price || product.original_price_zmw || 0);
  const sellingPrice = Number(product.price || product.price_zmw || 0);
  const discount = originalPrice > sellingPrice && originalPrice > 0
    ? Math.round((1 - sellingPrice / originalPrice) * 100)
    : 0;
  const ratingValue = Number(product.rating);
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const rating = Math.max(0, Math.min(5, ratingValue));
  return (
    <View style={[styles.productCard,{width:cardWidth,flexBasis:cardWidth,maxWidth:cardWidth},mobile && {padding:10,borderRadius:18,marginBottom:2}]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
        <View style={[styles.productImage, { backgroundColor: '#F6F9F7', height: imageHeight },mobile && {height:imageHeight,borderRadius:13,marginBottom:9}]}>
          {product.image_url ? <Image loading={imageLoading} source={{ uri: product.image_url }} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode={imageResizeMode} /> : <Ionicons name={product.icon || 'medical-outline'} size={38} color={COLORS.green} />}
          {hasRating ? <View style={styles.ratingBadge}><Ionicons name="star" size={10} color="#FFFFFF"/><Text style={styles.ratingBadgeText}>{rating.toFixed(1)}</Text></View> : null}
          {discount > 0 ? <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>{discount}% off</Text></View> : null}
        </View>
        <Text style={[styles.productName,mobile && {fontSize:14,lineHeight:19,minHeight:0,marginTop:1,marginBottom:0}]} numberOfLines={2}>{product.name}</Text>
      </Pressable>
      <View style={[styles.productBottom,mobile && {marginTop:1,gap:7,alignItems:'center'}]}>
        <View style={[styles.priceRow,mobile && {flexDirection:'column',alignItems:'flex-start',gap:1,flexWrap:'nowrap'}]}>
          <Text style={[styles.price,mobile && {fontSize:15,lineHeight:20}]} numberOfLines={1}>{money(sellingPrice)}</Text>
          {discount > 0 ? <Text style={styles.originalPrice} numberOfLines={1}>{money(originalPrice)}</Text> : null}
        </View>
        <Pressable onPress={() => onAdd(product)} style={[styles.addButton,mobile && {width:39,height:39,borderRadius:13,flexShrink:0}]} accessibilityLabel={`Add ${product.name} to cart`}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function StoreMenuBranch({ items, depth = 0, expandedId, setExpandedId, onSelect }) {
  return <View style={{paddingLeft: depth ? 14 : 0}}>{items.map(item => {
    const children = items._allItems ? items._allItems.filter(x => x.parent_id === item.id && x.is_active) : [];
    const hasChildren = children.length > 0;
    const expanded = Array.isArray(expandedId) && expandedId.includes(item.id);
    return <View key={item.id} style={{minWidth: depth ? 190 : 0}}>
      <Pressable onHoverIn={() => { if (hasChildren) setExpandedId(prev => [...new Set([...(Array.isArray(prev)?prev:[]), item.id])]); }} onPress={() => hasChildren ? setExpandedId(prev => { const current = Array.isArray(prev) ? prev : []; return expanded ? current.filter(id => id !== item.id) : [...current, item.id]; }) : onSelect(item)} style={{paddingVertical:10,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:depth?1:0,borderColor:'#E7EEE9',backgroundColor:expanded?'#EAF5EE':'#FFFFFF',borderRadius:8}}>
        <Text numberOfLines={1} style={{fontSize:13,fontWeight:depth===0?'800':'600',color:'#1D4ED8',flex:1}}>{item.label}</Text>
        {hasChildren ? <Ionicons name={expanded?'chevron-down':'chevron-forward'} size={14} color="#687A72"/> : null}
      </Pressable>
      {hasChildren && expanded ? <StoreMenuBranch items={Object.assign(children,{_allItems:items._allItems})} depth={depth+1} expandedId={expandedId} setExpandedId={setExpandedId} onSelect={onSelect}/> : null}
    </View>;
  })}</View>;
}

function KanevOrderProgress({ status, fulfilment }) {
  const normalized = String(status || 'pending_review').toLowerCase();
  const steps = [
    { key: 'pending_review', label: 'Received' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'preparing', label: 'Preparing' },
    { key: fulfilment === 'collection' ? 'ready_for_collection' : 'out_for_delivery', label: fulfilment === 'collection' ? 'Ready for collection' : 'Out for delivery' },
    { key: 'completed', label: fulfilment === 'collection' ? 'Collected' : 'Delivered' },
  ];
  const cancelled = normalized === 'cancelled';
  const index = cancelled ? -1 : Math.max(0, steps.findIndex(s => s.key === normalized));
  const progress = cancelled ? 0 : normalized === 'completed' ? 100 : Math.round((Math.max(index, 0) / (steps.length - 1)) * 100);
  const size = 72, stroke = 7, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const label = cancelled ? 'Cancelled' : (steps.find(s => s.key === normalized)?.label || String(status || 'Pending').replaceAll('_',' '));
  return <View style={{flexDirection:'row',alignItems:'center',gap:13,marginTop:12,padding:12,backgroundColor:'#F4F8F5',borderRadius:14,borderWidth:1,borderColor:'#DCE8E1'}}>
    <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size/2} cy={size/2} r={radius} stroke="#DCE8E1" strokeWidth={stroke} fill="none" />
        <Circle cx={size/2} cy={size/2} r={radius} stroke={cancelled?'#B42318':'#064E3B'} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference}`} strokeDashoffset={circumference*(1-progress/100)} rotation="-90" origin={`${size/2}, ${size/2}`} />
      </Svg>
      <Text style={{position:'absolute',fontSize:15,fontWeight:'900',color:cancelled?'#B42318':'#064E3B'}}>{cancelled?'—':`${progress}%`}</Text>
    </View>
    <View style={{flex:1,gap:4}}>
      <Text style={{fontSize:12,fontWeight:'800',color:'#687A72',textTransform:'uppercase',letterSpacing:.6}}>Order progress</Text>
      <Text style={{fontSize:16,fontWeight:'900',color:cancelled?'#B42318':'#064E3B'}}>{label}</Text>
      <Text style={{fontSize:12,color:'#687A72',lineHeight:17}}>{cancelled?'This order has been cancelled.':normalized==='completed'?'Your order is complete. Thank you for choosing Kanev Pharmacy.':'We’ll update this progress automatically as the pharmacy processes your order.'}</Text>
      {!cancelled ? <View style={{height:5,backgroundColor:'#DCE8E1',borderRadius:5,overflow:'hidden',marginTop:2}}><View style={{height:5,width:`${progress}%`,backgroundColor:'#DBEAFE',borderWidth:1,borderColor:'#93C5FD',borderRadius:5}} /></View> : null}
    </View>
  </View>;
}

export default function App() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isDesktop = viewportWidth >= 1024;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const [tab, setTab] = useState('Home');
  const [query, setQuery] = useState('');
  const [headerSearchFocused, setHeaderSearchFocused] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState({ label: 'Zambia', latitude: null, longitude: null });
  const [locationBusy, setLocationBusy] = useState(false);
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [cartStorageReady, setCartStorageReady] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const pageScrollRef = useRef(null);
  const [selectedProductImageIndex, setSelectedProductImageIndex] = useState(0);
  const [productImageHoverZoom, setProductImageHoverZoom] = useState(false);
  const [selectedProductQuantity, setSelectedProductQuantity] = useState(1);
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', deliveryNotes: '' });
  const [orderType, setOrderType] = useState('Delivery');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [products, setProducts] = useState([]);
  const [storeBanners, setStoreBanners] = useState([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueSource, setCatalogueSource] = useState(supabaseConfigured ? 'loading' : 'demo');
  const [session, setSession] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [orders, setOrders] = useState([]);
  const [healthDocuments, setHealthDocuments] = useState([]);
  const [expandedHealthDocumentId, setExpandedHealthDocumentId] = useState(null);
  const [selectedHealthDocumentViewer, setSelectedHealthDocumentViewer] = useState(null);
  const [healthDocMessages, setHealthDocMessages] = useState({});
  const [healthDocReplyDrafts, setHealthDocReplyDrafts] = useState({});
  const [healthDocSendingId, setHealthDocSendingId] = useState(null);
  const [healthDocUploading, setHealthDocUploading] = useState(false);
  const [selectedHealthAsset, setSelectedHealthAsset] = useState(null);
  const [healthDocType, setHealthDocType] = useState('prescription');
  const [healthDocTitle, setHealthDocTitle] = useState('');
  const [healthDocNotes, setHealthDocNotes] = useState('');
  const [expandedCustomerOrderId, setExpandedCustomerOrderId] = useState(null);
  const [orderTrackingEvents, setOrderTrackingEvents] = useState({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [accountSection, setAccountSection] = useState('profile');
  const [orderBusy, setOrderBusy] = useState(false);
  const [loginBranding, setLoginBranding] = useState(DEFAULT_LOGIN_BRANDING);
  const [cachedStartupLogoUrl, setCachedStartupLogoUrl] = useState('');
  const [storeMenuItems, setStoreMenuItems] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [expandedMenuId, setExpandedMenuId] = useState([]);
  const [desktopMenuRootId, setDesktopMenuRootId] = useState(null);
  const [desktopMenuCategoryId, setDesktopMenuCategoryId] = useState(null);
  // A clicked desktop menu stays open until clicked again or the user clicks elsewhere.
  const [desktopMenuPinned, setDesktopMenuPinned] = useState(false);
  const [desktopMenuAnchors, setDesktopMenuAnchors] = useState({});
  const menuNavRef = useRef(null);
  const menuItemRefs = useRef({});
  const menuCloseTimer = useRef(null);

  const measureDesktopMenuAnchor = useCallback((itemId, fallbackLayout) => {
    const itemNode = menuItemRefs.current?.[itemId];
    const navNode = menuNavRef.current;
    const saveFallback = () => {
      if (fallbackLayout) setDesktopMenuAnchors(prev => ({ ...prev, [itemId]: { x: fallbackLayout.x || 0, width: fallbackLayout.width || 120 } }));
    };
    if (!itemNode?.measureInWindow || !navNode?.measureInWindow) { saveFallback(); return; }
    itemNode.measureInWindow((itemX, _itemY, itemWidth) => {
      navNode.measureInWindow((navX) => {
        const x = Math.max(0, itemX - navX);
        setDesktopMenuAnchors(prev => ({ ...prev, [itemId]: { x, width: itemWidth || fallbackLayout?.width || 120 } }));
      });
    });
  }, []);

  const openDesktopMenu = useCallback((itemId, firstChildId, fallbackLayout) => {
    if (menuCloseTimer.current) clearTimeout(menuCloseTimer.current);
    measureDesktopMenuAnchor(itemId, fallbackLayout);
    setDesktopMenuRootId(itemId);
    setDesktopMenuCategoryId(firstChildId || null);
  }, [measureDesktopMenuAnchor]);

  const scheduleDesktopMenuClose = useCallback(() => {
    if (menuCloseTimer.current) clearTimeout(menuCloseTimer.current);
    menuCloseTimer.current = setTimeout(() => {
      if (!desktopMenuPinned) { setDesktopMenuRootId(null); setDesktopMenuCategoryId(null); }
    }, 220);
  }, [desktopMenuPinned]);

  // Clicking anywhere outside the navigation dismisses a click-pinned menu, while
  // allowing the clicked page control to receive its normal click as well.
  useEffect(() => {
    // Start each customer page at the top instead of retaining the previous screen's scroll position.
    pageScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab, selectedProduct?.id]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !desktopMenuRootId || typeof document === 'undefined') return undefined;
    const handleOutsidePointerDown = (event) => {
      const navNode = menuNavRef.current;
      if (navNode && event.target && !navNode.contains?.(event.target)) {
        if (menuCloseTimer.current) clearTimeout(menuCloseTimer.current);
        setDesktopMenuPinned(false);
        setDesktopMenuRootId(null);
        setDesktopMenuCategoryId(null);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [desktopMenuRootId]);
  const [notice, setNotice] = useState({ visible: false, title: '', message: '', tone: 'info' });

  // Keep the customer's cart across browser refreshes. Each cart line expires one
  // calendar month after it was last added; checkout only clears it after success.
  const CART_STORAGE_KEY = 'kanev_customer_cart_v1';
  useEffect(() => {
    let restoredCart = [];
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(CART_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) {
          const now = Date.now();
          restoredCart = parsed.filter(item => {
            if (!item || !item.id || !Number.isFinite(Number(item.qty)) || Number(item.qty) < 1) return false;
            const addedAt = Number(item.addedAt || now);
            const expiry = new Date(addedAt);
            expiry.setMonth(expiry.getMonth() + 1);
            return expiry.getTime() > now;
          }).map(item => ({ ...item, qty: Math.floor(Number(item.qty)), addedAt: Number(item.addedAt || now) }));
        }
      }
    } catch (error) {
      console.warn('Saved cart could not be restored:', error?.message || error);
    }
    setCart(restoredCart);
    setCartStorageReady(true);
  }, []);

  useEffect(() => {
    if (!cartStorageReady || Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.warn('Cart could not be saved locally:', error?.message || error);
    }
  }, [cart, cartStorageReady]);

  const rotatingProducts = useMemo(() => {
    const liveNames = products.map(p => p.name).filter(Boolean);
    const fallbackNames = (PRODUCTS || []).map(p => p.name).filter(Boolean);
    return [...new Set([...liveNames, ...fallbackNames])].slice(0, 12);
  }, [products]);
  const placeholderSlide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (query.trim() || rotatingProducts.length < 2) return undefined;
    const timer = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % rotatingProducts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [query, rotatingProducts.length]);
  useEffect(() => {
    if (query.trim()) return;
    placeholderSlide.setValue(12);
    Animated.timing(placeholderSlide, { toValue: 0, duration: 260, useNativeDriver: true }).start();
  }, [placeholderIndex, query, placeholderSlide]);
  // Keep typing immediate. Only update the catalogue filter after a short pause,
  // so large product lists never make the TextInput feel blocked on mobile.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(query.trim()), 140);
    return () => clearTimeout(timer);
  }, [query]);

  // Build the searchable text once per catalogue refresh rather than converting
  // every product field to lowercase on every keypress.
  const searchableProducts = useMemo(() => products.map(product => ({
    product,
    searchText: [
      product.name, product.brand, product.category, product.subcategory,
      product.summary, product.description, product.slug, product.sku, product.barcode
    ].map(value => String(value || '').toLocaleLowerCase()).join(' ')
  })), [products]);

  const headerSearchMatches = useMemo(() => {
    const term = debouncedSearchQuery.toLocaleLowerCase();
    if (!term) return [];
    const matches = [];
    for (const entry of searchableProducts) {
      if (entry.searchText.includes(term)) {
        matches.push(entry.product);
        if (matches.length === 8) break;
      }
    }
    return matches;
  }, [searchableProducts, debouncedSearchQuery]);

  const loadCatalogue = useCallback(async () => {
    if (!supabaseConfigured || !supabase) { setProducts(PRODUCTS); setCatalogueSource('demo'); setCatalogueLoading(false); return; }
    setCatalogueLoading(true);
    try {
      // Keep the core products query independent from PostgREST relationship metadata.
      // A missing/renamed FK relationship must not make the entire public catalogue fail.
      const productColumns = 'id,name,slug,description,summary,brand,image_url,price_zmw,original_price_zmw,rating,stock_quantity,requires_prescription,is_active,is_featured,category_id,menu_subcategory_id';
      // The image gallery migration may not have been applied yet. Keep the
      // public catalogue working with the legacy primary image until it is.
      // Start the product and lookup requests together. Previously the product
      // request completed before the category/menu requests even began, adding
      // an avoidable network round trip to every cold storefront load.
      const [initialProductResult, categoryResult, linkResult, menuResult] = await Promise.all([
        supabase.from('products').select(productColumns + ',image_urls')
          .eq('is_active', true).order('is_featured', { ascending: false }).order('name'),
        supabase.from('categories').select('id,name').eq('is_active', true),
        supabase.from('product_categories').select('product_id,category_id'),
        supabase.from('store_menu_items').select('id,label')
      ]);
      let productQuery = initialProductResult;
      if (productQuery.error && /image_urls|column .* does not exist|42703/i.test([productQuery.error.message,productQuery.error.details,productQuery.error.code].join(' '))) {
        console.warn('[Kanev catalogue] image_urls migration is pending; loading primary product images.');
        productQuery = await supabase.from('products').select(productColumns)
          .eq('is_active', true).order('is_featured', { ascending: false }).order('name');
      }
      const { data, error } = productQuery;
      if (error) throw error;
      const categoryNamesById = Object.fromEntries((categoryResult.data || []).map(row => [row.id, row.name]));
      const subcategoryNamesById = Object.fromEntries((menuResult.data || []).map(row => [row.id, row.label]));
      const assignmentsByProduct = {};
      if (!linkResult.error) (linkResult.data || []).forEach(link => {
        (assignmentsByProduct[link.product_id] ||= []).push(link.category_id);
      });

      setProducts((data || []).map(p => {
        const categoryIds = [...new Set([...(assignmentsByProduct[p.id] || []), p.category_id].filter(Boolean))];
        const categoryNames = [...new Set(categoryIds.map(id => categoryNamesById[id]).filter(Boolean))];
        return {
          ...p,
          image_urls: Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : (p.image_url ? [p.image_url] : []),
          category_ids: categoryIds,
          categories_list: categoryNames,
          price: Number(p.price_zmw || 0),
          original_price: Number(p.original_price_zmw || 0),
          rating: Number(p.rating ?? 5),
          discount_percent: Number(p.original_price_zmw) > Number(p.price_zmw) ? Math.round((1 - Number(p.price_zmw) / Number(p.original_price_zmw)) * 100) : 0,
          category: categoryNames[0] || 'Other',
          subcategory: subcategoryNamesById[p.menu_subcategory_id] || '',
          prescriptionRequired: p.requires_prescription,
          icon: 'medical-outline',
          tint: '#EAF4EE',
          badge: p.is_featured ? 'FEATURED' : undefined,
          stock: Number(p.stock_quantity || 0)
        };
      }));
      setCatalogueSource('live');
    } catch (error) {
      console.error('[Kanev catalogue] Failed to load products:', error);
      setProducts([]);
      setCatalogueSource('error');
    } finally {
      setCatalogueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogue();
    if (supabaseConfigured) { supabase.from('store_banners').select('*').eq('is_active', true).order('sort_order').then(({ data, error }) => { if (!error && data) { const now = Date.now(); setStoreBanners(data.filter(x => (!x.starts_at || new Date(x.starts_at).getTime() <= now) && (!x.ends_at || new Date(x.ends_at).getTime() >= now))); } }); }
    if (supabaseConfigured) { supabase.from('store_menu_items').select('id,label,node_type,parent_id,sort_order,is_active,destination_type,destination_value').eq('is_active', true).order('sort_order').then(({data,error}) => { if (!error && data) setStoreMenuItems(data); }); }
    if (supabaseConfigured) { supabase.from('categories').select('id,name,slug,image_url,is_active').eq('is_active', true).order('name').then(({data,error}) => { if (!error && data) setStoreCategories(data); }); }
    if (!supabaseConfigured) { setAuthInitialized(true); return; }

    let active = true;
    AsyncStorage.getItem('kanev_startup_logo_url').then(url => { if (active && url) setCachedStartupLogoUrl(url); }).catch(() => {});
    // Resolve the saved session and its admin role before rendering the storefront.
    // This prevents the customer home page flashing briefly when an admin refreshes.
    (async () => {
      try {
        // Session restoration is the only network result required before we
        // decide whether to show the storefront or the protected admin portal.
        // Branding loads independently so a slow branding row cannot hold the
        // entire application behind the startup screen.
        const brandingRequest = supabase.from('app_login_branding').select('*').eq('id', 'default').maybeSingle()
          .then(({ data: brandingData, error: brandingError }) => {
            if (!active) return;
            if (!brandingError && brandingData) {
              setLoginBranding(current => ({ ...current, ...brandingData }));
              if (brandingData.loading_logo_url) {
                setCachedStartupLogoUrl(brandingData.loading_logo_url);
                AsyncStorage.setItem('kanev_startup_logo_url', brandingData.loading_logo_url).catch(() => {});
                NativeImage.prefetch(brandingData.loading_logo_url).catch(() => {});
              }
            } else if (brandingError) {
              console.warn('[Kanev startup] Could not load startup branding:', brandingError.message);
            }
          }).catch(error => console.warn('[Kanev startup] Branding request failed:', error?.message || error));
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const initialSession = data.session || null;
        if (!active) return;
        setSession(initialSession);
        if (initialSession?.user?.id) {
          const { data: adminRow, error: roleError } = await supabase
            .from('admin_members')
            .select('role')
            .eq('user_id', initialSession.user.id)
            .maybeSingle();
          if (!active) return;
          if (!roleError && adminRow && ['owner', 'pharmacist', 'staff', 'fulfilment'].includes(adminRow.role)) {
            setTab('Management');
          } else {
            setTab('Home');
          }
        } else {
          setTab('Home');
        }
        // Keep the startup view visible until saved logo/title branding is loaded.
        await brandingRequest;
      } catch (_) {
        if (active) setTab('Home');
      } finally {
        if (active) setAuthInitialized(true);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setOrders([]);
        setTab(current => current === 'Management' ? 'Home' : current);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadCatalogue]);

  const loadOrders = useCallback(async () => {
    if (!supabaseConfigured || !session?.user) { setOrders([]); return; }
    let result = await supabase.from('orders').select('id,order_number,status,total_zmw,fulfilment,created_at,delivery_status,tracking_code,delivery_partner,delivered_at').eq('customer_id', session.user.id).order('created_at', { ascending: false }).limit(20);
    // Keep order history usable while a project is applying the delivery migration.
    if (result.error && /delivery_status|tracking_code|delivery_partner|delivered_at/i.test(result.error.message || '')) {
      result = await supabase.from('orders').select('id,order_number,status,total_zmw,fulfilment,created_at').eq('customer_id', session.user.id).order('created_at', { ascending: false }).limit(20);
    }
    const loadedOrders = result.data || [];
    setOrders(loadedOrders);
    if (loadedOrders.length) {
      const { data: events, error: eventError } = await supabase.from('order_tracking_events')
        .select('id,order_id,status,message,location,created_at')
        .in('order_id', loadedOrders.map(order => order.id))
        .order('created_at', { ascending: false });
      if (!eventError) {
        const grouped = {};
        (events || []).forEach(event => { (grouped[event.order_id] ||= []).push(event); });
        setOrderTrackingEvents(grouped);
      }
    } else setOrderTrackingEvents({});
  }, [session]);
  useEffect(() => { loadOrders(); }, [loadOrders]);
  // Live order updates: the customer timeline refreshes itself when staff change a
  // status or add a tracking event. No manual page refresh is needed.
  useEffect(() => {
    if (!supabaseConfigured || !session?.user?.id) return undefined;
    const channel = supabase.channel(`kanev-customer-orders-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${session.user.id}` }, () => { loadOrders(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking_events' }, (payload) => {
        const changedOrderId = payload?.new?.order_id || payload?.old?.order_id;
        if (changedOrderId && orders.some(order => order.id === changedOrderId)) loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, loadOrders, orders.map(o=>o.id).join('|')]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const filtered = useMemo(() => products.filter(p => {
    const matchesCategory = category === 'All' || p.category === category || (p.categories_list || []).includes(category) || p.subcategory === category;
    const term = query.trim().toLowerCase();
    return matchesCategory && (!term || [p.name,p.brand,p.category,...(p.categories_list||[]),p.subcategory,p.description,p.slug,p.sku,p.barcode].some(value => String(value || '').toLowerCase().includes(term)));
  }), [products, query, category]);

  const activeShopMenu = storeMenuItems.filter(item => item.is_active !== false);
  const shopMenuRoots = activeShopMenu.filter(item => !item.parent_id);
  const shopCategoryNodes = activeShopMenu.filter(item => item.parent_id && shopMenuRoots.some(root => root.id === item.parent_id));
  const selectedShopCategoryNode = shopCategoryNodes.find(item => item.label === category);
  const getShopCategoryDescendants = id => [id, ...activeShopMenu.filter(item => item.parent_id === id).flatMap(child => getShopCategoryDescendants(child.id))];
  const selectedShopCategoryIds = selectedShopCategoryNode ? new Set(getShopCategoryDescendants(selectedShopCategoryNode.id)) : null;
  const shopFiltered = products.filter(p => {
    const term = query.trim().toLowerCase();
    const searchOk = !term || [p.name,p.brand,p.category,...(p.categories_list || []),p.subcategory,p.description,p.slug,p.sku,p.barcode].some(value => String(value || '').toLowerCase().includes(term));
    const categoryOk = category === 'All' || (selectedShopCategoryNode
      ? (p.menu_subcategory_id && selectedShopCategoryIds.has(p.menu_subcategory_id)) || (p.categories_list || []).some(name => String(name).toLowerCase() === category.toLowerCase()) || String(p.category || '').toLowerCase() === category.toLowerCase()
      : p.category === category || (p.categories_list || []).includes(category));
    return searchOk && categoryOk;
  });
  const shopProductGroups = category === 'All' ? [] : Object.entries(shopFiltered.reduce((groups, product) => {
    const name = product.subcategory || 'Other products';
    (groups[name] ||= []).push(product);
    return groups;
  }, {}));

  const requireCustomerLogin = () => {
    if (session?.user) return true;
    setAuthMode('signin');
    setAuthModalVisible(true);
    return false;
  };

  const openStoreShop = (nextCategory = 'All') => {
    if (!requireCustomerLogin()) return;
    setSelectedProduct(null); setCategory(nextCategory); setTab('Shop');
  };
  const openStoreProduct = (product) => {
    if (!requireCustomerLogin()) return;
    setSelectedProduct(product); setSelectedProductImageIndex(0); setTab('Shop');
  };
  const openCustomerCart = () => {
    if (!requireCustomerLogin()) return;
    setSelectedProduct(null);
    setTab('Cart');
  };

  const startCustomerCheckout = () => {
    if (!requireCustomerLogin()) return;
    setSelectedProduct(null);
    setTab('Checkout');
  };

  const addToCart = (product, quantity = 1) => {
    if (!requireCustomerLogin()) return;
    const amount = Math.max(1, Math.floor(Number(quantity) || 1));
    if (product.stock !== undefined && product.stock < 1) return notify('Out of stock', 'This product is currently unavailable.');
    const inCart = cart.find(item => item.id === product.id);
    if (product.stock !== undefined && inCart && inCart.qty + amount > product.stock) return notify('Stock limit reached', 'You cannot add more than the available stock.');
    if (product.prescriptionRequired) {
      const msg = 'This item requires pharmacy review and a valid prescription before it can be dispensed. Please contact Kanev Pharmacy to continue.';
      notify('Prescription required', msg, 'warning');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const addedAt = Date.now();
      return existing
        ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + amount, addedAt } : item)
        : [...prev, { ...product, qty: amount, addedAt }];
    });
  };

  const changeQty = (id, delta) => setCart(prev => prev
    .map(item => item.id === id ? { ...item, qty: Math.min(item.stock === undefined ? 999 : item.stock, item.qty + delta) } : item)
    .filter(item => item.qty > 0));

  const notify = (title, message, tone = 'info') => {
    setNotice({ visible: true, title: String(title || 'Kanev Pharmacy'), message: String(message || ''), tone });
  };

  const placeOrder = async () => {
    if (!cart.length) return notify('Your cart is empty', 'Add products before checking out.');
    if (!supabaseConfigured) return notify('Temporarily unavailable', 'Ordering is not available right now. Please try again later or contact Kanev Pharmacy.','warning');
    if (!requireCustomerLogin()) return;
    if (!customer.name.trim() || !customer.phone.trim()) return notify('Details required', 'Please enter your name and phone number.');
    if (orderType === 'Delivery' && !customer.address.trim()) return notify('Delivery address required', 'Enter the address where you would like your order delivered.');
    setOrderBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('kanev-create-order', { body: { customer_name: customer.name.trim(), customer_phone: customer.phone.trim(), delivery_address: orderType === 'Delivery' ? customer.address.trim() : null,
        delivery_notes: orderType === 'Delivery' ? String(customer.deliveryNotes || '').trim() || null : null,
        delivery_latitude: orderType === 'Delivery' && Number.isFinite(deliveryLocation.latitude) ? deliveryLocation.latitude : null,
        delivery_longitude: orderType === 'Delivery' && Number.isFinite(deliveryLocation.longitude) ? deliveryLocation.longitude : null,
        fulfilment: orderType.toLowerCase(), items: cart.map(item => ({ product_id: item.id, quantity: item.qty })) } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Order submission failed.');
      setCart([]); setTab('Account'); await loadOrders(); notify('Order request received', `Your reference is ${data.order_number}. The pharmacy will confirm availability, payment arrangements and delivery details. Track progress in Your account.`);
    } catch (e) { notify('Order not submitted', 'We could not submit your order request. Please check your details and connection, then try again.','error'); }
    finally { setOrderBusy(false); }
  };

  const loadHealthDocuments = useCallback(async () => {
    if (!supabaseConfigured || !session?.user?.id) { setHealthDocuments([]); setHealthDocMessages({}); return; }
    const {data,error} = await supabase.from('customer_health_documents').select('id,document_type,title,notes,file_path,file_name,mime_type,file_size,status,admin_feedback,reviewed_at,created_at,conversation_closed_at').eq('customer_id',session.user.id).order('created_at',{ascending:false}).limit(100);
    if (error) { console.warn('Health documents could not load:',error.message); return; }
    const docs=await Promise.all((data||[]).map(async doc=>{ if(!doc.file_path)return doc; const {data:signed,error:signedError}=await supabase.storage.from('customer-health-documents').createSignedUrl(doc.file_path,3600); if(signedError)console.warn('Could not create health document preview URL:',signedError.message); return {...doc,preview_url:signed?.signedUrl||null}; })); setHealthDocuments(docs);
    if (!docs.length) { setHealthDocMessages({}); return; }
    const {data:messages,error:messageError}=await supabase.from('customer_health_document_messages').select('id,document_id,sender_id,sender_role,message,created_at,read_at,read_by').in('document_id',docs.map(d=>d.id)).order('created_at',{ascending:true});
    if (!messageError) { const grouped={}; (messages||[]).forEach(m=>{(grouped[m.document_id] ||= []).push(m);}); setHealthDocMessages(grouped); }
    else console.warn('Conversation messages could not load:',messageError.message);
  },[session?.user?.id]);
  useEffect(()=>{loadHealthDocuments();},[loadHealthDocuments]);
  // Keep the customer's submissions and pharmacy feedback in sync without page refreshes.
  useEffect(()=>{
    if(!supabaseConfigured || !session?.user?.id)return undefined;
    const channel=supabase.channel(`kanev-customer-health-${session.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'customer_health_documents',filter:`customer_id=eq.${session.user.id}`},()=>{loadHealthDocuments();})
      .on('postgres_changes',{event:'*',schema:'public',table:'customer_health_document_messages'},payload=>{const id=payload?.new?.document_id||payload?.old?.document_id;if(id&&healthDocuments.some(d=>d.id===id))loadHealthDocuments();})
      .subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[session?.user?.id,loadHealthDocuments,healthDocuments.map(d=>d.id).join('|')]);
  const markHealthDocumentRead = async (doc) => {
    if (!doc?.id || !session?.user?.id) return;
    const unread=(healthDocMessages[doc.id]||[]).filter(m=>m.sender_role==='admin'&&!m.read_at);
    if (!unread.length) return;
    const readAt=new Date().toISOString();
    setHealthDocMessages(prev=>({...prev,[doc.id]:(prev[doc.id]||[]).map(m=>m.sender_role==='admin'&&!m.read_at?{...m,read_at:readAt,read_by:session.user.id}:m)}));
    const {error}=await supabase.rpc('mark_customer_health_document_messages_read',{p_document_id:doc.id});
    if(error){console.warn('Could not save message read receipt:',error.message);await loadHealthDocuments();}
  };
  const toggleHealthDocument = (doc, expanded) => {
    setExpandedHealthDocumentId(expanded?null:doc.id);
    if(!expanded) markHealthDocumentRead(doc);
  };

  const sendHealthDocumentReply = async (doc) => {
    const message=String(healthDocReplyDrafts[doc.id]||'').trim();
    if(!message) return notify('Write a reply','Enter a message before sending.');
    if(doc.conversation_closed_at) return notify('Conversation closed','Kanev Pharmacy has closed this conversation, so replies are disabled.','warning');
    setHealthDocSendingId(doc.id);
    try {
      const {error}=await supabase.from('customer_health_document_messages').insert({document_id:doc.id,sender_id:session.user.id,sender_role:'customer',message});
      if(error) throw error;
      setHealthDocReplyDrafts(prev=>({...prev,[doc.id]:''}));
      await loadHealthDocuments();
      notify('Reply sent','Your message has been sent to Kanev Pharmacy.');
    } catch(e) { notify('Reply not sent',e?.message||'Please try again.','error'); }
    finally { setHealthDocSendingId(null); }
  };

  const chooseHealthDocumentFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const mime = asset.mimeType || (String(asset.name || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Choose a PDF, JPG, PNG or WebP file.');
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Please choose a file smaller than 10 MB.');
      setSelectedHealthAsset({ ...asset, mimeType: mime });
    } catch (e) {
      notify('File not selected', e?.message || 'We could not open that file. Please try again.', 'error');
    }
  };

  const uploadHealthDocument = async () => {
    if (!requireCustomerLogin()) return;
    if (!supabaseConfigured) return notify('Temporarily unavailable', 'Document upload is unavailable right now. Please try again later.', 'warning');
    if (!selectedHealthAsset) return notify('Choose a document first', 'Select a prescription or lab result so you can preview it before submitting.');
    setHealthDocUploading(true);
    let uploadedPath = null;
    try {
      const asset = selectedHealthAsset;
      const mime = asset.mimeType || 'image/jpeg';
      const ext = (asset.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('customer-health-documents').upload(path, blob, { upsert: false, contentType: mime, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      uploadedPath = path;
      const row = { customer_id: session.user.id, document_type: healthDocType, title: healthDocTitle.trim() || (healthDocType === 'prescription' ? 'Prescription' : 'Lab result'), notes: healthDocNotes.trim() || null, file_path: path, file_name: asset.name || `health-document.${ext}`, mime_type: mime, file_size: asset.size || blob.size, status: 'submitted' };
      const { error: insertError } = await supabase.from('customer_health_documents').insert(row);
      if (insertError) throw insertError;
      setSelectedHealthAsset(null);
      setHealthDocTitle('');
      setHealthDocNotes('');
      await loadHealthDocuments();
      notify('Document submitted', 'Your document has been securely submitted. Kanev Pharmacy will review it and post feedback here.');
    } catch (e) {
      if (uploadedPath) await supabase.storage.from('customer-health-documents').remove([uploadedPath]).catch(() => {});
      notify('Upload failed', e?.message || 'We could not upload this document. Please try again.', 'error');
    } finally { setHealthDocUploading(false); }
  };
  const normalizeZambiaPhone = (raw) => {
    const input = String(raw || '').trim();
    const digits = input.replace(/\D/g, '');
    if (!digits) return '';
    // Accept common Zambian formats: 0977..., 260977..., +260977...
    if (digits.startsWith('260')) return `+${digits}`;
    if (digits.startsWith('0')) return `+260${digits.slice(1)}`;
    // A 9-digit local mobile number may be entered without the leading 0.
    if (digits.length === 9) return `+260${digits}`;
    return `+260${digits}`;
  };

  const handleAuth = async () => {
    if (!supabaseConfigured) return notify('Temporarily unavailable', 'Account services are not available right now. Please try again later.','warning');
    if (!authPassword) return notify('Password required', 'Enter your password to continue.');
    if (authPassword.length < 6) {
  return notify(
    'Password too short',
    'Your password must contain at least 6 characters.'
  );
}
    setAuthBusy(true);
    try {
      if (authMode === 'signup') {
        const phone = normalizeZambiaPhone(authPhone);
        if (!authName.trim() || !authEmail.trim() || !phone) throw new Error('Enter your full name, email address and mobile number.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) throw new Error('Enter a valid email address.');
        // Email and phone are both collected at registration. Phone sign-in must be enabled for your account before customers can use it.
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim().toLowerCase(),
          phone,
          password: authPassword,
          options: { data: { full_name: authName.trim(), phone, customer_email: authEmail.trim().toLowerCase() } }
        });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          setAuthModalVisible(false);
          notify('Account created', 'Welcome to Kanev Pharmacy. Your account is ready.');
        } else {
          // Prepare the sign-in screen BEFORE opening the confirmation notice.
          // Continue only dismisses the notice; it does not control auth mode.
          setAuthIdentifier(authEmail.trim().toLowerCase());
          setAuthPassword('');
          setAuthMode('signin');
          notify('Check your messages', 'We have sent or started the verification process for your account. Check your email or phone for the verification message. Once verified, continue to sign in.');
        }
      } else {
        const identifier = authIdentifier.trim();
        if (!identifier) throw new Error('Enter the email address or mobile number you used to register.');
        let data, error;
        if (identifier.includes('@')) {
          ({ data, error } = await supabase.auth.signInWithPassword({ email: identifier.toLowerCase(), password: authPassword }));
        } else {
          // Option B: resolve the customer's phone on the server. This keeps
          // the service-role key out of the app and does not require Twilio.
          const phone = normalizeZambiaPhone(identifier);
          const { data: phoneResult, error: phoneError } = await supabase.functions.invoke(
            'kanev-phone-login',
            { body: { phone, password: authPassword } },
          );
          if (phoneError || !phoneResult?.access_token || !phoneResult?.refresh_token) {
            throw new Error(phoneResult?.error || 'Those sign-in details do not match our records. Check them and try again.');
          }
          ({ data, error } = await supabase.auth.setSession({
            access_token: phoneResult.access_token,
            refresh_token: phoneResult.refresh_token,
          }));
        }
        if (error) throw error;
        const signedUser = data.session?.user;
        let verifiedAdmin = false;
        if (signedUser && identifier.includes('@')) {
          const { data: staffRows, error: roleError } = await supabase.from('admin_members').select('role').eq('user_id', signedUser.id).limit(1);
          verifiedAdmin = !roleError && !!staffRows?.length && ['owner', 'pharmacist', 'staff', 'fulfilment'].includes(staffRows[0].role);
        }
        // Do not reveal the storefront between successful admin authentication and role verification.
        if (verifiedAdmin) {
          setNotice(current => ({ ...current, visible: false }));
          setSelectedProduct(null);
          setTab('Management');
          setSession(data.session);
          setAuthModalVisible(false);
          return;
        }
        setSession(data.session);
        setAuthModalVisible(false);
        notify('Signed in', 'Welcome back to Kanev Pharmacy.');
      }
    } catch (e) {
      const raw = String(e?.message || '').toLowerCase();
      const status = Number(e?.status || e?.statusCode || e?.context?.status || 0);
      const duplicateSignup = authMode === 'signup' && (
        raw.includes('already registered') || raw.includes('already been registered') ||
        raw.includes('user exists') || raw.includes('email address is already')
      );
      const signupRateLimited = authMode === 'signup' && (
        status === 429 || raw.includes('too many requests') || raw.includes('rate limit')
      );

      if (duplicateSignup || signupRateLimited) {
        // Do not submit signup repeatedly. Preserve the email and prepare sign-in
        // before displaying the notice so Continue always lands on sign-in.
        setAuthIdentifier(authEmail.trim().toLowerCase());
        setAuthPassword('');
        setAuthMode('signin');
        notify(
          'Verification email sent already',
          duplicateSignup
            ? 'An account or verification request already exists for this email. Please check your inbox and spam folder for the verification email. Press Continue to sign in after verification.'
            : 'A verification request may already have been sent, but the service is temporarily limiting new requests. Please check your inbox and spam folder before trying again. Press Continue to go to sign in.',
          'warning'
        );
      } else {
        const message = raw.includes('email not confirmed') || raw.includes('confirm')
          ? 'Please check your email or phone for a verification message and follow its instructions.'
          : raw.includes('invalid login') || raw.includes('invalid credentials')
            ? 'Those sign-in details do not match our records. Check them and try again.'
            : 'We could not complete that account request. Check your details and try again, or contact Kanev Pharmacy for help.';
        notify('Unable to continue', message, 'error');
      }
    }
    finally { setAuthBusy(false); }
  };
  const updateProfilePhoto = async () => {
    if (!session?.user?.id) return notify('Sign in required', 'Please sign in to update your profile photo.');
    if (!supabaseConfigured) return notify('Temporarily unavailable', 'Profile photos are not available right now. Please try again later.', 'warning');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return notify('Photo access needed', 'Allow access to your photos to choose a profile picture.', 'warning');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return notify('Photo too large', 'Choose an image smaller than 5 MB.', 'warning');
      setAvatarBusy(true);
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const contentType = asset.mimeType || blob.type || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const path = `${session.user.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage.from('customer-avatars').upload(path, blob, { upsert: true, contentType, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('customer-avatars').getPublicUrl(path);
      const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
      const { data, error: profileError } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      if (profileError) throw profileError;
      setSession(current => current ? { ...current, user: data.user || { ...current.user, user_metadata: { ...current.user.user_metadata, avatar_url: avatarUrl } } } : current);
      notify('Profile photo updated', 'Your new profile photo has been saved to your Kanev Pharmacy account.');
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase().includes('bucket')
        ? 'Profile photo storage is not set up yet. Run the included setup SQL in your Supabase project, then try again.'
        : 'We could not save that photo. Please try another image or try again later.';
      notify('Photo not saved', msg, 'error');
    } finally { setAvatarBusy(false); }
  };

  const removeProfilePhoto = async () => {
    if (!session?.user?.id) return;
    setAvatarBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (error) throw error;
      setSession(current => current ? { ...current, user: { ...current.user, user_metadata: { ...current.user.user_metadata, avatar_url: null } } } : current);
      notify('Profile photo removed', 'Your account is now using the default profile icon.');
    } catch (_) { notify('Unable to remove photo', 'Please try again later.', 'error'); }
    finally { setAvatarBusy(false); }
  };

  const signOut = async () => { if (supabaseConfigured) await supabase.auth.signOut(); setSession(null); setOrders([]); setNotice(current => ({ ...current, visible: false })); setTab('Home'); setSelectedProduct(null); };

  const useCurrentDeliveryLocation = async () => {
    setLocationBusy(true);
    try {
      let coords;
      let approximate = false;

      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          throw new Error('This browser cannot access device location. Enter your delivery address manually.');
        }

        // Ask for a fast, network-assisted browser location first. Desktop PCs often
        // have no GPS, so high-accuracy mode can wait until it times out unnecessarily.
        const getBrowserPosition = (options) => new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
            reject,
            options,
          );
        });

        try {
          const position = await getBrowserPosition({
            enableHighAccuracy: false,
            timeout: 25000,
            maximumAge: 120000,
          });
          coords = { latitude: position.latitude, longitude: position.longitude };
        } catch (browserError) {
          if (browserError?.code === 1) {
            throw new Error('Location permission is blocked. Allow location for localhost:8081 in Edge, then try again.');
          }

          // Browser/Windows location may not work on desktop PCs. Use an IP-based
          // estimate only as a clearly-labelled fallback; it is not a precise address.
          try {
            const response = await fetch('https://ipapi.co/json/', { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Approximate location lookup failed.');
            const result = await response.json();
            const latitude = Number(result.latitude);
            const longitude = Number(result.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !result.city) {
              throw new Error('Approximate location was not returned.');
            }
            coords = { latitude, longitude };
            approximate = true;
          } catch (_) {
            if (browserError?.code === 3) {
              throw new Error('Windows/Edge could not determine your exact location, and approximate location lookup also failed. Check your connection or enter your delivery address manually.');
            }
            if (browserError?.code === 2) {
              throw new Error('Your device could not determine its location. Approximate lookup also failed; please enter your delivery address manually.');
            }
            throw new Error('We could not determine your location. Please enter your delivery address manually.');
          }
        }
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location permission was not granted. You can type an address instead.');
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      }

      let label = `${approximate ? 'Approximate location' : 'Current location'} (${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)})`;
      try {
        const rows = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        const place = rows?.[0];
        if (place) {
          const address = [place.name, place.street, place.subregion, place.city, place.region]
            .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
          if (address) label = approximate ? `Approx. ${address}` : address;
        }
      } catch (_) {
        // Keep the coordinates if reverse geocoding is unavailable.
      }

      setDeliveryLocation({ label, latitude: coords.latitude, longitude: coords.longitude });
      setCustomer(prev => ({ ...prev, address: label }));
      setDeliverySearch(label);
      notify(
        approximate ? 'Approximate location selected' : 'Delivery location selected',
        approximate
          ? 'We could not obtain a precise device location, so this is an IP-based estimate and may be inaccurate. Please edit and verify the delivery address before saving.'
          : 'Your current device location has been added as the delivery address. Please verify the address before saving.',
        approximate ? 'warning' : 'info',
      );
    } catch (e) {
      notify('Location unavailable', e.message || 'Please enter your delivery address manually.', 'warning');
    } finally {
      setLocationBusy(false);
    }
  };
  const searchDeliveryOnGoogleMaps = async () => {
    const term = deliverySearch.trim();
    if (!term) return notify('Enter a location', 'Type an area, street, landmark or address to find it on Google Maps.', 'warning');
    try { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term)}`); }
    catch (_) { notify('Google Maps unavailable', 'Please search Google Maps in your browser, then enter the selected address here.', 'warning'); }
  };
  const saveDeliveryLocation = () => {
    const label = deliverySearch.trim();
    if (!label) return notify('Delivery address required', 'Enter or choose a delivery location before saving.', 'warning');
    setDeliveryLocation(prev => ({ ...prev, label }));
    setCustomer(prev => ({ ...prev, address: label }));
    setDeliveryModalVisible(false);
  };

  const selectStoreMenuItem = (item) => {
    setExpandedMenuId([]);
    setDesktopMenuPinned(false);
    setDesktopMenuRootId(null);
    setDesktopMenuCategoryId(null);
    const destination = String(item.destination_type || 'category');
    const value = String(item.destination_value || item.label || '').trim();
    if (destination === 'url' && /^https?:\/\//i.test(value)) { Linking.openURL(value).catch(() => notify('Link unavailable','This menu link could not be opened.','warning')); return; }
    // Leaving a product detail view must restore the catalogue before
    // applying the selected header category.
    setSelectedProduct(null);
    setSelectedProductImageIndex(0);
    setSelectedProductQuantity(1);
    setCategory(destination === 'all' ? 'All' : value || item.label);
    setQuery('');
    setTab('Shop');
  };

  const Header = () => (
    <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && styles.headerCompact]}>
      <Pressable style={[styles.brandRow, !isDesktop && {flex:1,minWidth:0,gap:9}]} onPress={() => { setTab('Home'); setSelectedProduct(null); }} accessibilityRole="button" accessibilityLabel="Kanev Pharmacy home">
        <View style={[styles.headerLogoHolder,!isDesktop&&{width:43,height:43}]}>
          {loginBranding.header_logo_url ? <Image loading="eager" source={{ uri: loginBranding.header_logo_url }} style={[styles.headerLogoImage,!isDesktop&&{width:43,height:43,borderRadius:9}]} resizeMode="contain" /> : null}
        </View>
        <View style={{ minWidth: 0,flexShrink:1 }}>
          <Text numberOfLines={1} style={[styles.brandName, { color: loginBranding.brand_title_color || COLORS.green, fontSize: Math.min(Number(loginBranding.brand_title_size) || 15, isDesktop?18:15), fontFamily: loginBranding.brand_title_font_family === 'System' ? undefined : loginBranding.brand_title_font_family }]}>{loginBranding.pharmacy_title || 'Kanev Pharmacy'}</Text>
          {isDesktop && <Text numberOfLines={1} style={[styles.tagline, { color: loginBranding.tagline_color || COLORS.blue, fontSize: Math.min(Number(loginBranding.tagline_size) || 10, 12), fontFamily: loginBranding.tagline_font_family === 'System' ? undefined : loginBranding.tagline_font_family }]}>{loginBranding.tagline || 'Closer to Your Health'}</Text>}
        </View>
      </Pressable>
      {isDesktop ? (
        <View style={styles.desktopHeaderTools}>
          <Pressable style={styles.desktopDelivery} onPress={() => { if (!requireCustomerLogin()) return; setDeliverySearch(deliveryLocation.label === 'Zambia' ? '' : deliveryLocation.label); setDeliveryModalVisible(true); }}>
            <Ionicons name="location-outline" size={19} color={COLORS.blue} />
            <View style={{ maxWidth: 125 }}><Text style={styles.desktopDeliveryLabel}>Deliver to</Text><Text numberOfLines={1} style={styles.desktopDeliveryValue}>{deliveryLocation.label || 'Choose location'}</Text></View>
            <Ionicons name="chevron-down" size={15} color={COLORS.muted} />
          </Pressable>
          <View style={styles.desktopSearchWrap}>
            <View style={styles.desktopSearch}>
              <Ionicons name="search-outline" size={21} color={COLORS.muted} />
              <TextInput value={query} onFocus={() => { if (!session?.user) { requireCustomerLogin(); return; } setHeaderSearchFocused(true); }} onBlur={() => setTimeout(() => setHeaderSearchFocused(false), 350)} onChangeText={value => { if (session?.user) setQuery(value); }} onSubmitEditing={() => openStoreShop('All')} placeholder="" placeholderTextColor="#7C8A84" style={styles.desktopSearchInput} returnKeyType="search" />
              {!query.trim() && rotatingProducts.length > 0 && <View pointerEvents="none" style={styles.rotatingPlaceholderClip}><Text style={[styles.rotatingPlaceholderText, { fontWeight: '900' }]}>Shop </Text><View style={styles.rotatingProductClip}><Animated.Text numberOfLines={1} style={[styles.rotatingPlaceholderText,{transform:[{translateY:placeholderSlide}]}]}>{rotatingProducts[placeholderIndex % rotatingProducts.length]}…</Animated.Text></View></View>}
              {query.length > 0 && <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={COLORS.muted}/></Pressable>}
              <Pressable style={styles.desktopSearchButton} onPress={() => {openStoreShop('All');setHeaderSearchFocused(false);}}><Text style={styles.desktopSearchButtonText}>Search</Text></Pressable>
            </View>
            {headerSearchFocused && query.trim().length > 0 && <View style={styles.headerSearchDropdown}>
              {catalogueLoading ? <Text style={styles.headerSearchNoResult}>Searching the product catalogue…</Text> : headerSearchMatches.length ? headerSearchMatches.map(p => <Pressable key={p.id} style={styles.headerSearchResult} onPress={() => {openStoreProduct(p);setHeaderSearchFocused(false);}}><View style={styles.headerSearchResultIcon}>{p.image_url ? <Image source={{uri:p.image_url}} style={{width:34,height:34,borderRadius:8}} resizeMode="contain"/> : <Ionicons name="medical-outline" size={19} color={COLORS.green}/>}</View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.headerSearchResultName}>{p.name}</Text><Text numberOfLines={1} style={styles.headerSearchResultMeta}>{p.category || p.brand || 'Pharmacy product'}</Text></View><Text style={styles.headerSearchResultPrice}>{money(p.price)}</Text></Pressable>) : <Text style={styles.headerSearchNoResult}>No matching products found.</Text>}
              <Pressable style={styles.headerSearchAll} onPress={() => {openStoreShop('All');setHeaderSearchFocused(false);}}><Text style={styles.headerSearchAllText}>View all search results</Text><Ionicons name="arrow-forward" size={15} color={COLORS.blue}/></Pressable>
            </View>}
          </View>
          <Pressable style={styles.desktopHeaderLink} onPress={() => { if (session?.user) setTab('Account'); else requireCustomerLogin(); }}><Ionicons name="person-outline" size={18} color={COLORS.blue}/><Text style={styles.desktopHeaderLinkText}>{session?.user ? 'My account' : 'Login / Sign up'}</Text></Pressable>
          <Pressable style={styles.desktopCart} onPress={openCustomerCart} accessibilityLabel={`Cart with ${cartCount} items`}>
            <Ionicons name="cart-outline" size={25} color={COLORS.blue} /><Text style={styles.desktopHeaderLinkText}>Cart{cartCount ? ` (${cartCount})` : ''}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{flexDirection:'row',alignItems:'center',gap:7,marginLeft:6}}>
          <Pressable style={[styles.cartHeader,{width:43,height:40,borderRadius:11,backgroundColor:'#F0F7F2'}]} onPress={() => {openCustomerCart();setMobileHeaderMenuOpen(false);}} accessibilityLabel={`Cart with ${cartCount} items`}>
            <Ionicons name="cart-outline" size={23} color={COLORS.green}/>
            {cartCount > 0 && <View style={styles.cartDot}><Text style={styles.cartDotText}>{cartCount}</Text></View>}
          </Pressable>
          <Pressable onPress={()=>{if(!requireCustomerLogin())return;setMobileHeaderMenuOpen(v=>!v);}} style={{width:39,height:40,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#F0F7F2'}} accessibilityRole="button" accessibilityLabel="Open menu">
            <Ionicons name={mobileHeaderMenuOpen?'close':'ellipsis-vertical'} size={23} color={COLORS.green}/>
          </Pressable>
          {mobileHeaderMenuOpen && <View style={{position:'absolute',right:0,top:47,width:205,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:13,padding:7,zIndex:3000,elevation:24,shadowColor:'#17382B',shadowOpacity:.18,shadowRadius:14,shadowOffset:{width:0,height:7},gap:2}}>
            {[
              {label:'Home',icon:'home-outline',action:()=>{setTab('Home');setSelectedProduct(null);}},
              {label:'Shop products',icon:'grid-outline',action:()=>openStoreShop('All')},
              {label:session?.user?'My account':'Sign in',icon:'person-outline',action:()=>{if(session?.user)setTab('Account');else{setAuthMode('signin');setAuthModalVisible(true);}}},
              {label:'Delivery location',icon:'location-outline',action:()=>{if(!requireCustomerLogin())return;setDeliverySearch(deliveryLocation.label==='Zambia'?'':deliveryLocation.label);setDeliveryModalVisible(true);}},
            ].map(item=><Pressable key={item.label} onPress={()=>{setMobileHeaderMenuOpen(false);item.action();}} style={{minHeight:43,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:10,borderRadius:8}}>
              <Ionicons name={item.icon} size={18} color={COLORS.green}/><Text style={{fontSize:13,fontWeight:'700',color:COLORS.ink}}>{item.label}</Text>
            </Pressable>)}
          </View>}
        </View>
      )}
    </View>
  );

  const Home = () => (
    <>

      <View style={styles.tmHero}>
        {isDesktop && (
        <View style={styles.tmHeroServices}>
          {[
            { title: 'Upload Prescriptions', subtitle: 'Easy & Fast', icon: 'receipt-outline', color: '#087F50', action: () => { setHealthDocType('prescription'); if (session?.user) setTab('HealthDocuments'); else { setTab('Account'); setAuthMode('signin'); setAuthModalVisible(true); } } },
            { title: 'Lab Test Results', subtitle: 'Secure Access', icon: 'flask-outline', color: '#1769FF', action: () => { setHealthDocType('lab_result'); if (session?.user) setTab('HealthDocuments'); else { setTab('Account'); setAuthMode('signin'); setAuthModalVisible(true); } } },
            { title: 'Delivery in 2 HRS', subtitle: 'Within Lusaka', icon: 'car-outline', color: '#F4A900', action: () => notify('Fast delivery', 'Two-hour delivery is subject to your location, stock availability and pharmacy confirmation.') },
            { title: 'Health Insurance', subtitle: 'Co-pay Support', icon: 'shield-checkmark-outline', color: '#F04452', action: () => notify('Health insurance', 'Contact Kanev Pharmacy to confirm accepted insurance providers and co-pay arrangements.') },
          ].map((item) => (
            <Pressable key={item.title} style={styles.tmServiceTile} onPress={item.action} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.subtitle}`}>
              <Ionicons name={item.icon} size={29} color={item.color} />
              <View style={styles.tmServiceCopy}>
                <Text style={styles.tmServiceTitle}>{item.title}</Text>
                <Text style={styles.tmServiceSubtitle}>{item.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        )}
        {storeBanners.filter(x=>x.placement==='hero_side').length ? storeBanners.filter(x=>x.placement==='hero_side').map(banner=><Pressable key={banner.id} onPress={()=>banner.link_url&&/^https?:\/\//i.test(banner.link_url)?Linking.openURL(banner.link_url).catch(()=>{}):openStoreShop('All')} style={[styles.tmHeroSide,{backgroundColor:banner.background_color||'#D6F1E0',overflow:'hidden',position:'relative',}]}>{(banner.image_url||(Array.isArray(banner.image_urls)&&banner.image_urls.length))?<BannerImageSlideshow banner={banner} opacity={1} showDots={true}/>:null}<View style={{zIndex:1,alignItems:'center',justifyContent:'center',flex:1,padding:12,backgroundColor:(banner.image_url||(Array.isArray(banner.image_urls)&&banner.image_urls.length))?'rgba(4,43,31,0.18)':'transparent',borderRadius:18}}><Text style={[styles.tmHeroSideTitle,{color:banner.text_color||((banner.image_url||(Array.isArray(banner.image_urls)&&banner.image_urls.length))?'#FFFFFF':COLORS.green),textShadowColor:'rgba(0,0,0,0.45)',textShadowOffset:{width:0,height:1},textShadowRadius:3}]}>{banner.title}</Text>{banner.description?<Text style={[styles.tmHeroSideText,{color:banner.text_color||((banner.image_url||(Array.isArray(banner.image_urls)&&banner.image_urls.length))?'#FFFFFF':COLORS.muted),textShadowColor:'rgba(0,0,0,0.45)',textShadowOffset:{width:0,height:1},textShadowRadius:3}]}>{banner.description}</Text>:null}{banner.button_text?<Text style={{fontSize:12,fontWeight:'800',color:banner.eyebrow_color||((banner.image_url||(Array.isArray(banner.image_urls)&&banner.image_urls.length))?'#C8F36A':COLORS.green),marginTop:8,textShadowColor:'rgba(0,0,0,0.45)',textShadowOffset:{width:0,height:1},textShadowRadius:3}}>{banner.button_text} →</Text>:null}</View></Pressable>) : <View style={styles.tmHeroSide}><Text style={styles.tmHeroSideTitle}>{loginBranding.benefit_three}</Text><Text style={styles.tmHeroSideText}>Health, wellness and personal care in one place</Text></View>}
      </View>
      {isDesktop && <View style={styles.tmQuickActions}>
        <Pressable style={styles.tmQuickCard} onPress={() => openStoreShop('All')}><View style={styles.tmQuickIcon}><Ionicons name="medical-outline" size={27} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.tmQuickTitle}>Order medicines</Text><Text style={styles.tmQuickSubtitle}>Explore the live catalogue</Text></View><Ionicons name="arrow-forward" size={20} color={COLORS.green}/></Pressable>
        {isDesktop && <Pressable style={styles.tmQuickCard} onPress={() => { setHealthDocType('prescription'); if (session?.user) setTab('HealthDocuments'); else { setTab('Account'); setAuthMode('signin'); setAuthModalVisible(true); } }}><View style={styles.tmQuickIcon}><Ionicons name="document-text-outline" size={27} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.tmQuickTitle}>Have a prescription?</Text><Text style={styles.tmQuickSubtitle}>Contact our pharmacy team for review</Text></View><Ionicons name="arrow-forward" size={20} color={COLORS.green}/></Pressable>}
      </View>}
      {isDesktop && (storeBanners.some(x => x.placement === 'hero') ? storeBanners.filter(x => x.placement === 'hero').map(banner => <Pressable key={banner.id} onPress={() => banner.link_url ? Linking.openURL(banner.link_url).catch(()=>notify('Link unavailable','This banner link could not be opened.','warning')) : openStoreShop('All')} style={[styles.tmPromoBanner,{backgroundColor:banner.background_color||'#0B4B38',overflow:'hidden',minHeight:banner.image_url?220:150}]}>{(banner.image_url || (Array.isArray(banner.image_urls) && banner.image_urls.length))?<BannerImageSlideshow banner={banner} opacity={.95}/>:null}<View style={{flex:1,zIndex:1}}><Text style={[styles.tmPromoEyebrow,{color:banner.eyebrow_color||'#C8F36A'}]}>{banner.eyebrow||'Kanev Pharmacy'}</Text><Text style={[styles.tmPromoTitle,{color:banner.text_color||'#FFFFFF'}]}>{banner.title}</Text>{banner.description?<Text style={[styles.tmPromoSub,{color:banner.text_color||'#FFFFFF'}]}>{banner.description}</Text>:null}{banner.button_text?<View style={[styles.tmPromoButton,{alignSelf:'flex-start',backgroundColor:banner.button_color||'#C8F36A'}]}><Text style={styles.tmPromoButtonText}>{banner.button_text}  →</Text></View>:null}</View></Pressable>) : <View style={styles.tmPromoBanner}><View style={{flex:1}}><Text style={styles.tmPromoEyebrow}>Kanev Pharmacy</Text><Text style={styles.tmPromoTitle}>Everyday essentials for the whole family</Text><Text style={styles.tmPromoSub}>Discover skincare, baby care, vitamins and more.</Text><Pressable style={styles.tmPromoButton} onPress={() => openStoreShop('All')}><Text style={styles.tmPromoButtonText}>Shop now  →</Text></Pressable></View><Ionicons name="heart-circle" size={82} color="#C3ED8A"/></View>)}
      <View style={styles.roundCategorySection}>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Shop by category</Text><Text style={styles.homeSectionSub}>Find what you need, faster</Text></View><Pressable onPress={() => openStoreShop('All')}><Text style={styles.link}>View all  ›</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roundCategoryScroller}>
          {(storeCategories.length ? storeCategories : CATEGORIES.map((item,i)=>({id:item.name,name:item.name,image_url:''}))).map((item,i)=>{
            const fallbackProduct = products.find(product => (product.category_ids || []).includes(item.id) || (product.categories_list || []).some(name => String(name).toLowerCase() === String(item.name).toLowerCase()) || String(product.category || '').toLowerCase() === String(item.name).toLowerCase());
            const image = item.image_url || fallbackProduct?.image_url || '';
            const icon = CATEGORIES.find(c=>c.name.toLowerCase()===String(item.name).toLowerCase())?.icon || 'medkit-outline';
            return <Pressable key={item.id || item.name} style={styles.roundCategoryItem} onPress={()=>openStoreShop(item.name)} accessibilityRole="button" accessibilityLabel={`Shop ${item.name}`}>
              <View style={styles.roundCategoryImageWrap}>
                {image ? <Image loading={i < 8 ? 'eager' : 'lazy'} source={{uri:optimizedImageUrl(image, 240, 72, 'cover')}} style={styles.roundCategoryImage} resizeMode="cover" /> : <View style={[styles.roundCategoryFallback,{backgroundColor:['#E4F1CF','#E9DDF8','#F7DDF2','#DDEBFA','#FCE6DD','#E5F2E9'][i%6]}]}><Ionicons name={icon} size={37} color={COLORS.green}/></View>}
              </View>
              <Text style={styles.roundCategoryLabel} numberOfLines={2}>{item.name}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </View>
      {/* Removed the duplicate compact category strip; the richer category explorer below is retained. */}
      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Popular items</Text><Text style={styles.homeSectionSub}>Browse available pharmacy products</Text></View><Pressable onPress={() => openStoreShop('All')}><Text style={styles.link}>View all  →</Text></Pressable></View>
      {catalogueLoading ? <View style={styles.homeLoading}><Text style={styles.smallNote}>Loading live products…</Text></View> : null}
      {!catalogueLoading && !products.length && catalogueSource !== 'error' ? <View style={styles.homeLoading}><Ionicons name="basket-outline" size={30} color={COLORS.muted}/><Text style={styles.supportTitle}>No products published yet</Text><Text style={styles.supportText}>The pharmacy catalogue will appear here when products are available.</Text></View> : null}
      <View style={styles.productGrid}>{products.slice(0,10).map((p,index) => <ProductCard key={p.id} product={p} cardWidth={isDesktop?'19%':isTablet?'32%':'48%'} imageResizeMode="cover" imageLoading={index < (isDesktop ? 5 : 4) ? 'eager' : 'lazy'} onAdd={addToCart} onOpen={() => openStoreProduct(p)}/>)}</View>
      {products.length > 10 ? <><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>More to explore</Text><Text style={styles.homeSectionSub}>Healthcare and personal care favourites</Text></View></View><View style={styles.productGrid}>{products.slice(10,20).map(p => <ProductCard key={p.id} product={p} cardWidth={isDesktop?'19%':isTablet?'32%':'48%'} onAdd={addToCart} onOpen={() => openStoreProduct(p)}/>)}</View></> : null}
      {!catalogueLoading && catalogueSource === 'error' ? <View style={styles.homeLoading}><Text style={styles.supportTitle}>Catalogue unavailable</Text><ActionButton title="Retry" secondary onPress={loadCatalogue}/></View> : null}
      <View style={styles.marketPanel}>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Deals you'll love</Text><Text style={styles.homeSectionSub}>Everyday essentials at great prices</Text></View><Pressable onPress={() => openStoreShop('All')}><Text style={styles.link}>View all  ›</Text></Pressable></View>
        <View style={styles.promoTiles}>{(storeBanners.filter(x => x.placement === 'deal_tile').length ? storeBanners.filter(x => x.placement === 'deal_tile') : [{id:'default-deal-1',eyebrow:'Kanev offers',title:'Care that fits your budget',button_text:'Explore offers',background_color:'#E3F3FC',text_color:'#1D4ED8',link_url:''},{id:'default-deal-2',eyebrow:'Wellness picks',title:'Support your everyday wellbeing',button_text:'Shop wellness',background_color:'#FFF0DE',text_color:'#1D4ED8',link_url:'wellness'}]).slice(0,4).map((banner,index)=><Pressable key={banner.id} style={[styles.promoTile,{backgroundColor:banner.background_color||'#E3F3FC',overflow:'hidden'}]} onPress={()=>{if(banner.link_url&&/^https?:\/\//i.test(banner.link_url)) Linking.openURL(banner.link_url).catch(()=>{}); else openStoreShop(index===1?'Wellness':'All');}}>{(banner.image_url || (Array.isArray(banner.image_urls) && banner.image_urls.length))?<BannerImageSlideshow banner={banner} opacity={.24} showDots={false}/>:null}<Text style={[styles.promoTileKicker,{color:banner.text_color||'#064E3B'}]}>{banner.eyebrow||'Kanev Pharmacy'}</Text><Text style={[styles.promoTileTitle,{color:banner.text_color||'#064E3B'}]}>{banner.title}</Text><Text style={[styles.promoTileLink,{color:banner.text_color||'#236DA8'}]}>{banner.button_text||'Explore' }  →</Text></Pressable>)}</View>
      </View>

      {(() => {
        const activeMenu = storeMenuItems.filter(item => item.is_active !== false);
        const roots = activeMenu.filter(item => !item.parent_id);
        const getDescendantIds = (parentId) => {
          const found = [parentId];
          activeMenu.filter(item => item.parent_id === parentId).forEach(child => found.push(...getDescendantIds(child.id)));
          return found;
        };
        const configuredIds = Array.isArray(loginBranding.homepage_category_ids) ? loginBranding.homepage_category_ids : [];
        const selectedNodes = configuredIds.map(id => activeMenu.find(item => item.id === id)).filter(item => item && item.parent_id);
        const sections = selectedNodes.map(node => {
          const ids = new Set(getDescendantIds(node.id));
          const normalizedLabel = String(node.label || '').trim().toLowerCase();
          const list = products.filter(product => {
            if (product.menu_subcategory_id && ids.has(product.menu_subcategory_id)) return true;
            const names = [product.category, ...(product.categories_list || []), product.subcategory].filter(Boolean).map(value => String(value).trim().toLowerCase());
            return names.includes(normalizedLabel);
          }).slice(0, 10);
          return { id: node.id, heading: node.label, list };
        }).filter(section => section.list.length > 0);
        return <>{sections.map((section, sectionIndex) => {
          const inlinePlacement = sectionIndex === 1 ? 'category_slot_2_3' : sectionIndex === 4 ? 'category_slot_5_6' : null;
          const inlineBanners = inlinePlacement ? storeBanners.filter(banner => banner.placement === inlinePlacement && banner.is_active !== false) : [];
          return <View key={section.id}>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionTitle}>{section.heading}</Text><Text style={styles.homeSectionSub}>Shop by {section.heading.toLowerCase()}</Text></View>
              <Pressable onPress={() => openStoreShop(section.heading)}><Text style={styles.link}>View all  ›</Text></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productCarousel}>
              {section.list.map(product => (
                <View key={`${section.id}-${product.id}`} style={styles.carouselProduct}>
                  <ProductCard product={product} cardWidth="100%" imageHeight={88} imageResizeMode="cover" onAdd={addToCart} onOpen={() => openStoreProduct(product)} />
                </View>
              ))}
            </ScrollView>
          {inlineBanners.map(banner => <Pressable key={banner.id} onPress={() => banner.link_url && String(banner.link_url).startsWith('http') ? Linking.openURL(banner.link_url).catch(() => {}) : openStoreShop('All')} style={{width:'100%',height:112,borderRadius:12,overflow:'hidden',backgroundColor:banner.background_color||'#E8F3EC',marginBottom:20,position:'relative'}}>{(banner.image_url || (Array.isArray(banner.image_urls) && banner.image_urls.length)) ? <BannerImageSlideshow banner={banner} opacity={1} showDots={false}/> : null}{(!banner.image_url && !(Array.isArray(banner.image_urls) && banner.image_urls.length)) ? <View style={{flex:1,justifyContent:'center',padding:18}}><Text style={{fontSize:18,fontWeight:'900',color:banner.text_color||COLORS.green}}>{banner.title}</Text>{banner.description ? <Text style={{fontSize:12,color:banner.text_color||COLORS.green,marginTop:4}}>{banner.description}</Text> : null}</View> : null}</Pressable>)}
          </View>;
        })}
        {sections.length < 5 ? storeBanners.filter(banner => banner.placement === 'category_slot_5_6' && banner.is_active !== false).map(banner => <Pressable key={banner.id} onPress={() => banner.link_url && String(banner.link_url).startsWith('http') ? Linking.openURL(banner.link_url).catch(() => {}) : openStoreShop('All')} style={{width:'100%',height:112,borderRadius:12,overflow:'hidden',backgroundColor:banner.background_color||'#E8F3EC',marginBottom:20,position:'relative'}}>{(banner.image_url || (Array.isArray(banner.image_urls) && banner.image_urls.length)) ? <BannerImageSlideshow banner={banner} opacity={1} showDots={false}/> : null}{(!banner.image_url && !(Array.isArray(banner.image_urls) && banner.image_urls.length)) ? <View style={{flex:1,justifyContent:'center',padding:18}}><Text style={{fontSize:18,fontWeight:'900',color:banner.text_color||COLORS.green}}>{banner.title}</Text>{banner.description ? <Text style={{fontSize:12,color:banner.text_color||COLORS.green,marginTop:4}}>{banner.description}</Text> : null}</View> : null}</Pressable>) : null}
        </>
      })()}
      <View style={styles.orderVia}><Text style={styles.orderViaEyebrow}>A SIMPLE WAY TO ORDER</Text><Text style={styles.orderViaTitle}>Choose how we can help</Text><View style={styles.orderViaCards}><Pressable style={styles.orderViaCard} onPress={()=>openStoreShop('All')}><Ionicons name="call-outline" size={26} color={COLORS.green}/><View style={{flex:1}}><Text style={styles.tmQuickTitle}>Browse and order online</Text><Text style={styles.tmQuickSubtitle}>Choose products and submit an order request.</Text></View><Ionicons name="chevron-forward" size={18} color={COLORS.green}/></Pressable><Pressable style={styles.orderViaCard} onPress={()=>setTab('Account')}><Ionicons name="document-attach-outline" size={26} color={COLORS.green}/><View style={{flex:1}}><Text style={styles.tmQuickTitle}>Have a prescription?</Text><Text style={styles.tmQuickSubtitle}>Sign in to contact the pharmacy about prescription review.</Text></View><Ionicons name="chevron-forward" size={18} color={COLORS.green}/></Pressable></View></View>
      <View style={styles.contentEditorial}>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Health articles</Text><Text style={styles.homeSectionSub}>Helpful information for everyday wellbeing</Text></View></View>
        {(() => {
          const editorialBanners = storeBanners.filter(x => x.placement === 'editorial');
          const defaults = [
            {id:'article-1',title:'Taking medicines safely',description:'Follow the instructions on your medicine label and ask a pharmacist if you are unsure.',button_text:'Learn more'},
            {id:'article-2',title:'Building healthy routines',description:'Small, consistent choices can support your everyday wellbeing.',button_text:'Learn more'},
            {id:'article-3',title:'Ask a pharmacist',description:'Get professional guidance when you need help choosing a suitable product.',button_text:'Learn more'}
          ];
          const cards = [0,1,2].map(i => editorialBanners[i] || defaults[i]);
          // Treat every uploaded editorial image as one shared pool. Each card starts
          // at a different image; a single uploaded image naturally appears on all cards.
          const imagePool = [...new Set(editorialBanners.flatMap(b => [
            ...(Array.isArray(b.image_urls) ? b.image_urls : []), b.image_url
          ]).filter(url => typeof url === 'string' && url.trim()))];
          return <View style={styles.editorialGrid}>{cards.map((banner,index) => {
            const cardBanner = imagePool.length ? {...banner, image_urls:imagePool, image_url:imagePool[index % imagePool.length], image_fit:'cover'} : banner;
            const hasImage = imagePool.length > 0 || banner.image_url || (Array.isArray(banner.image_urls) && banner.image_urls.length);
            return <View key={banner.id || `article-${index}`} style={styles.editorialCard}>
              {hasImage ? <BannerImageSlideshow banner={cardBanner} style={{borderRadius:13}} showDots={false} initialIndex={index}/> : null}
              <View pointerEvents="none" style={styles.editorialContentOverlay}>
                <Text style={[styles.link, styles.editorialImageTitle]}>{banner.title}</Text>
              </View>
            </View>;
          })}</View>;
        })()}
      </View>
      {storeBanners.filter(x=>x.placement==='testimonial').length?storeBanners.filter(x=>x.placement==='testimonial').map(banner=><View key={banner.id} style={[styles.testimonialPanel,{backgroundColor:banner.background_color||'#E6F4FF',overflow:'hidden'}]}>{(banner.image_url||(Array.isArray(banner.image_urls)&&banner.image_urls.length))?<BannerImageSlideshow banner={banner} opacity={.16} showDots={false}/>:null}<View style={{zIndex:1}}><Text style={[styles.sectionTitle,{color:banner.text_color||COLORS.green}]}>{banner.title}</Text>{banner.description?<Text style={[styles.testimonialQuote,{color:banner.text_color||COLORS.green}]}>{banner.description}</Text>:null}{banner.button_text?<Pressable onPress={()=>banner.link_url&&/^https?:\/\//i.test(banner.link_url)?Linking.openURL(banner.link_url).catch(()=>{}):openStoreShop('All')}><Text style={styles.link}>{banner.button_text}  →</Text></Pressable>:null}</View></View>):<View style={styles.testimonialPanel}><Text style={styles.sectionTitle}>Care that comes closer</Text><Text style={styles.testimonialQuote}>“Your health matters. Our pharmacy team is here to help you find suitable products and understand the next steps.”</Text><Text style={styles.homeSectionSub}>Kanev Pharmacy · Closer to Your Health</Text></View>}
      <View style={styles.faqPanel}><Text style={styles.sectionTitle}>Frequently asked questions</Text>{[['Can I order online?','Yes. Browse available products, add them to your cart and submit an order request.'],['Can I order prescription medicines?','Prescription medicines require pharmacy review and a valid prescription where applicable.'],['Can I choose delivery or collection?','Available fulfilment options will be confirmed by the pharmacy when processing your order.'],['When is my order confirmed?','Submitting an order request is not payment confirmation. The pharmacy must confirm availability and payment separately.']].map(([q,a])=><View key={q} style={styles.faqRow}><Text style={styles.faqQuestion}>{q}</Text><Text style={styles.faqAnswer}>{a}</Text></View>)}</View>
      <View style={styles.tmHelpBanner}><Ionicons name="chatbubbles-outline" size={29} color={COLORS.green}/><View style={{flex:1}}><Text style={styles.tmQuickTitle}>Need help with your order?</Text><Text style={styles.tmQuickSubtitle}>Our pharmacy team can help you choose suitable products and explain prescription requirements.</Text></View><Pressable onPress={() => setTab('Account')}><Text style={styles.link}>Get help  →</Text></Pressable></View>
    </>
  );

  const Shop = () => (
    <>
      <View style={styles.searchResultsHeading}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.pageTitle}>{query.trim() ? 'Search results' : 'Shop products'}</Text>
          {isDesktop && <Text style={styles.pageSubtitle}>{query.trim() ? `Results for “${query.trim()}”` : 'Find pharmacy, wellness and personal care essentials.'}</Text>}
        </View>
        {query.trim() ? <Pressable style={styles.clearSearchAction} onPress={() => setQuery('')}><Ionicons name="close-circle-outline" size={16} color={COLORS.green}/><Text style={styles.clearSearchActionText}>Clear search</Text></Pressable> : null}
      </View>
      {catalogueLoading && <Text style={styles.smallNote}>Loading live catalogue…</Text>}
      {!catalogueLoading && catalogueSource === 'demo' && <Text style={styles.smallNote}>Preview catalogue — live stock and prices will appear when the catalogue is connected.</Text>}
      {!catalogueLoading && catalogueSource === 'error' && <View style={styles.emptyState}><Text style={styles.emptyTitle}>Could not load the live catalogue</Text><Text style={styles.emptyBody}>We couldn’t retrieve the product catalogue. Please try again.</Text><ActionButton title="Retry catalogue" onPress={loadCatalogue} /></View>}
      {!catalogueLoading && catalogueSource === 'live' && products.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyTitle}>No products published yet</Text><Text style={styles.emptyBody}>Add active products in the pharmacy catalogue to display them here.</Text><ActionButton title="Refresh catalogue" onPress={loadCatalogue} secondary /></View>}
      {isDesktop && (<View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={COLORS.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search by product, brand or category..." placeholderTextColor="#83918A" style={styles.searchInput} returnKeyType="search" />
        {query.length > 0 && <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color={COLORS.muted} /></Pressable>}
      </View>)}
      {isDesktop && (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
        {['All', ...shopCategoryNodes.map(item => item.label)].map(c => (
          <Pressable key={c} onPress={() => openStoreShop(c)} style={[styles.filterChip, category === c && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, category === c && styles.filterChipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>)}
      <Text style={styles.resultsText}>{shopFiltered.length} {shopFiltered.length === 1 ? 'product' : 'products'}{query.trim() ? ` found for “${query.trim()}”` : category !== 'All' ? ` in ${category}` : ' available'}</Text>
      {category === 'All' ? <View style={styles.productGrid}>
        {shopFiltered.map(p => <ProductCard key={p.id} product={p} cardWidth={isDesktop ? '19%' : '48%'} imageHeight={isDesktop ? 145 : 176} imageResizeMode={isDesktop ? 'cover' : 'contain'} mobile={!isDesktop} onAdd={addToCart} onOpen={() => openStoreProduct(p)} />)}
      </View> : shopProductGroups.map(([groupName, groupProducts]) => (
        <View key={groupName} style={{marginBottom:22}}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{groupName}</Text><Text style={styles.homeSectionSub}>{groupProducts.length} {groupProducts.length===1?'product':'products'}</Text></View>
          <View style={styles.productGrid}>{groupProducts.map(p => <ProductCard key={p.id} product={p} cardWidth={isDesktop ? '19%' : '48%'} imageHeight={isDesktop ? 145 : 176} imageResizeMode={isDesktop ? 'cover' : 'contain'} mobile={!isDesktop} onAdd={addToCart} onOpen={() => openStoreProduct(p)} />)}</View>
        </View>
      ))}
      {shopFiltered.length === 0 && <View style={styles.searchEmptyState}>
        <View style={styles.searchEmptyIcon}><Ionicons name="search-outline" size={30} color={COLORS.green}/></View>
        <Text style={styles.emptyTitle}>{query.trim() ? `No results for “${query.trim()}”` : 'No products in this category yet'}</Text>
        <Text style={styles.emptyBody}>Try a different product name, brand or category. You can also clear the filters and browse the full catalogue.</Text>
        <View style={styles.searchEmptyActions}>
          <ActionButton title="Clear search and filters" onPress={() => { setQuery(''); setCategory('All'); }} />
          <ActionButton title="Refresh catalogue" secondary onPress={loadCatalogue} />
        </View>
      </View>}
    </>
  );

  const Cart = () => (
    <View style={styles.commercePage}>
      <View style={styles.commerceHeadingRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.pageTitle}>Your shopping cart</Text>
          <Text style={styles.pageSubtitle}>Review your pharmacy essentials before checkout.</Text>
        </View>
        <View style={styles.cartCountPill}><Ionicons name="bag-check-outline" size={17} color={COLORS.green}/><Text style={styles.cartCountPillText}>{cartCount} item{cartCount === 1 ? '' : 's'}</Text></View>
      </View>
      <View style={styles.checkoutTrustRow}>
        {[['shield-checkmark-outline','Pharmacy reviewed'],['bicycle-outline','Delivery or collection'],['chatbubble-ellipses-outline','Order confirmation']].map(([icon,label])=><View key={label} style={styles.checkoutTrustItem}><Ionicons name={icon} size={17} color={COLORS.green}/><Text style={styles.checkoutTrustText}>{label}</Text></View>)}
      </View>
      {cart.length === 0 ? (
        <View style={styles.cartEmptyCard}>
          <View style={styles.cartEmptyIcon}><Ionicons name="bag-handle-outline" size={42} color={COLORS.green}/></View>
          <Text style={styles.emptyTitle}>Your cart is waiting</Text>
          <Text style={styles.emptyBody}>Browse the catalogue and add the products you need. Your selected items will appear here.</Text>
          <ActionButton title="Continue shopping" onPress={() => openStoreShop('All')} />
        </View>
      ) : (
        <View style={[styles.commerceColumns, isDesktop && styles.commerceColumnsDesktop]}>
          <View style={[styles.cartProductsPanel, isDesktop && styles.cartProductsPanelDesktop]}>
            <View style={styles.panelHeadingRow}><Text style={styles.panelHeading}>Items in your basket</Text><Pressable onPress={() => { setCart([]); notify('Cart cleared','All items have been removed from your cart.'); }}><Text style={styles.clearCartText}>Clear cart</Text></Pressable></View>
            {cart.map(item => (
              <View key={item.id} style={styles.cartProductRow}>
                <View style={[styles.cartProductImage, { backgroundColor: item.tint || '#EAF4EE' }]}>
                  {item.image_url ? <Image source={{ uri: optimizedImageUrl(item.image_url, 320, 72) }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <Ionicons name={item.icon || 'medical-outline'} size={30} color={COLORS.green} />}
                </View>
                <View style={styles.cartProductInfo}>
                  <Text style={styles.cartProductCategory}>{item.category || 'PHARMACY PRODUCT'}</Text>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  {item.brand ? <Text style={styles.cartProductBrand}>{item.brand}</Text> : null}
                  <Text style={styles.cartItemPrice}>{money(item.price)} <Text style={{fontWeight:'500',color:COLORS.muted}}>per item</Text></Text>
                  {item.prescriptionRequired ? <View style={styles.prescriptionTag}><Ionicons name="document-text-outline" size={13} color="#8A5A00"/><Text style={styles.prescriptionTagText}>Pharmacy prescription review required</Text></View> : null}
                  <View style={styles.cartProductActions}>
                    <View style={styles.qtyControl}>
                      <Pressable onPress={() => changeQty(item.id, -1)} style={styles.qtyControlButton} accessibilityLabel={`Decrease ${item.name}`}><Ionicons name="remove" size={17} color={COLORS.green}/></Pressable>
                      <Text style={styles.qtyControlValue}>{item.qty}</Text>
                      <Pressable onPress={() => changeQty(item.id, 1)} disabled={Number.isFinite(item.stock) && item.qty >= item.stock} style={[styles.qtyControlButton, Number.isFinite(item.stock) && item.qty >= item.stock && {opacity:0.35}]} accessibilityLabel={`Increase ${item.name}`}><Ionicons name="add" size={17} color={COLORS.green}/></Pressable>
                    </View>
                    <Pressable onPress={() => setCart(prev => prev.filter(row => row.id !== item.id))} style={styles.removeCartButton}><Ionicons name="trash-outline" size={15} color="#B42318"/><Text style={styles.removeCartText}>Remove</Text></Pressable>
                  </View>
                </View>
                <View style={styles.cartProductLineTotal}><Text style={styles.lineTotal}>{money(item.price * item.qty)}</Text><Text style={styles.cartLineCaption}>Line total</Text></View>
              </View>
            ))}
            <Pressable style={styles.continueShoppingLink} onPress={() => openStoreShop('All')}><Ionicons name="arrow-back" size={16} color={COLORS.green}/><Text style={styles.continueShoppingText}>Continue shopping</Text></Pressable>
          </View>
          <View style={[styles.orderSummaryCard, isDesktop && styles.orderSummaryCardDesktop]}>
            <Text style={styles.panelHeading}>Order summary</Text>
            <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Items ({cartCount})</Text><Text style={styles.summaryValue}>{money(total)}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Delivery</Text><Text style={styles.summaryValuePending}>Confirmed by pharmacy</Text></View>
            <View style={styles.summaryDivider}/>
            <View style={styles.summaryTotalLine}><Text style={styles.summaryTotalLabel}>Subtotal</Text><Text style={styles.summaryTotalValue}>{money(total)}</Text></View>
            <Text style={styles.summaryNote}>Delivery fees, availability and any prescription requirements will be confirmed by the pharmacy before fulfilment.</Text>
            <ActionButton title="Proceed to checkout" onPress={startCustomerCheckout} />
            <View style={styles.summarySecure}><Ionicons name="lock-closed-outline" size={15} color={COLORS.green}/><Text style={styles.summarySecureText}>Your order details are handled securely.</Text></View>
          </View>
        </View>
      )}
    </View>
  );

  const Checkout = () => (
    <View style={styles.commercePage}>
      <Pressable onPress={() => openCustomerCart()} style={styles.checkoutBackLink}><Ionicons name="arrow-back" size={17} color={COLORS.green}/><Text style={styles.continueShoppingText}>Back to cart</Text></Pressable>
      <Text style={styles.pageTitle}>Secure checkout</Text>
      <Text style={styles.pageSubtitle}>Provide your contact and fulfilment details. The pharmacy will review your request and confirm availability before fulfilment.</Text>
      <View style={styles.checkoutProgress}>
        {[['1','Cart'],['2','Your details'],['3','Pharmacy confirmation']].map(([n,label],i)=><View key={n} style={styles.checkoutProgressStep}><View style={[styles.checkoutStepCircle, i < 2 && styles.checkoutStepCircleActive]}><Text style={[styles.checkoutStepNumber, i < 2 && styles.checkoutStepNumberActive]}>{n}</Text></View><Text style={[styles.checkoutStepLabel, i===1 && {color:COLORS.green,fontWeight:'900'}]}>{label}</Text>{i<2?<View style={[styles.checkoutStepLine,i===0&&{backgroundColor:'#B6D8C4'}]}/>:null}</View>)}
      </View>
      {cart.length === 0 ? <View style={styles.cartEmptyCard}><View style={styles.cartEmptyIcon}><Ionicons name="bag-handle-outline" size={40} color={COLORS.green}/></View><Text style={styles.emptyTitle}>Your cart is empty</Text><Text style={styles.emptyBody}>Add products before starting checkout.</Text><ActionButton title="Browse products" onPress={() => openStoreShop('All')}/></View> : (
        <View style={[styles.commerceColumns, isDesktop && styles.commerceColumnsDesktop]}>
          <View style={[styles.checkoutDetailsPanel, isDesktop && styles.checkoutDetailsPanelDesktop]}>
            <View style={styles.checkoutSectionHeading}><View style={styles.checkoutSectionIcon}><Ionicons name="person-outline" size={20} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.panelHeading}>Contact information</Text><Text style={styles.checkoutSectionSub}>How the pharmacy can reach you about your order.</Text></View></View>
            <View style={isDesktop ? styles.checkoutFieldsGrid : undefined}>
              <View style={isDesktop ? styles.checkoutFieldHalf : undefined}><Text style={styles.fieldLabel}>Full name *</Text><TextInput value={customer.name} onChangeText={v => setCustomer(prev => ({ ...prev, name: v }))} placeholder="Enter your full name" placeholderTextColor="#87968E" autoComplete="name" style={styles.fieldInput}/></View>
              <View style={isDesktop ? styles.checkoutFieldHalf : undefined}><Text style={styles.fieldLabel}>Phone number *</Text><TextInput value={customer.phone} onChangeText={v => setCustomer(prev => ({ ...prev, phone: v }))} placeholder="e.g. 0977 123 456" placeholderTextColor="#87968E" keyboardType="phone-pad" autoComplete="tel" style={styles.fieldInput}/><Text style={styles.fieldHelper}>Use a number where the pharmacy can reach you.</Text></View>
            </View>
            <View style={styles.checkoutFormDivider}/>
            <View style={styles.checkoutSectionHeading}><View style={styles.checkoutSectionIcon}><Ionicons name="bicycle-outline" size={20} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.panelHeading}>How would you like to receive your order?</Text><Text style={styles.checkoutSectionSub}>Choose delivery or collection.</Text></View></View>
            <View style={styles.fulfilmentChoices}>
              {['Delivery','Collection'].map(t => <Pressable key={t} onPress={() => setOrderType(t)} style={[styles.fulfilmentChoice, orderType === t && styles.fulfilmentChoiceActive]}><View style={[styles.fulfilmentChoiceIcon,orderType===t&&styles.fulfilmentChoiceIconActive]}><Ionicons name={t==='Delivery'?'bicycle-outline':'storefront-outline'} size={22} color={orderType===t?'#FFFFFF':COLORS.green}/></View><View style={{flex:1}}><Text style={[styles.fulfilmentChoiceTitle,orderType===t&&{color:COLORS.green}]}>{t}</Text><Text style={styles.fulfilmentChoiceSub}>{t==='Delivery'?'Have your order delivered to your address':'Arrange collection with the pharmacy'}</Text></View><Ionicons name={orderType===t?'radio-button-on':'radio-button-off'} size={20} color={orderType===t?COLORS.green:'#9AA9A1'}/></Pressable>)}
            </View>
            {orderType === 'Delivery' && <>
              <Text style={styles.fieldLabel}>Delivery address *</Text>
              <TextInput value={customer.address} onChangeText={v => setCustomer(prev => ({ ...prev, address: v }))} placeholder="Area, street, house number and directions" placeholderTextColor="#87968E" multiline style={[styles.fieldInput, { minHeight: 84, textAlignVertical: 'top' }]}/>
              <Pressable onPress={() => { setDeliverySearch(customer.address || deliveryLocation.label || ''); setDeliveryModalVisible(true); }} style={styles.checkoutLocationButton}><View style={styles.checkoutLocationIcon}><Ionicons name="location-outline" size={19} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.checkoutLocationTitle}>Choose or verify location</Text><Text style={styles.checkoutLocationSub}>Use your address or find the area on a map.</Text></View><Ionicons name="chevron-forward" size={18} color={COLORS.green}/></Pressable>
              <Text style={styles.fieldLabel}>Delivery instructions <Text style={{fontWeight:'500',color:COLORS.muted}}>(optional)</Text></Text>
              <TextInput value={customer.deliveryNotes || ''} onChangeText={v => setCustomer(prev => ({ ...prev, deliveryNotes: v }))} placeholder="Landmark, gate or directions for the rider" placeholderTextColor="#87968E" multiline style={[styles.fieldInput, { minHeight: 68, textAlignVertical: 'top' }]}/>
              <View style={styles.deliveryInfoNotice}><Ionicons name="information-circle-outline" size={20} color={COLORS.blue}/><Text style={styles.deliveryInfoNoticeText}>The delivery fee and estimated timing will be confirmed by the pharmacy. Please verify your address before submitting.</Text></View>
            </>}
            <View style={styles.pharmacyReviewNotice}><Ionicons name="medical-outline" size={20} color={COLORS.green}/><View style={{flex:1}}><Text style={styles.pharmacyReviewTitle}>Pharmacy review comes first</Text><Text style={styles.pharmacyReviewText}>Submitting this form sends an order request. It is not a payment confirmation, and prescription items may require a valid prescription and pharmacist approval.</Text></View></View>
          </View>
          <View style={[styles.orderSummaryCard, isDesktop && styles.orderSummaryCardDesktop]}>
            <Text style={styles.panelHeading}>Your order</Text>
            <Text style={styles.checkoutSummaryCount}>{cartCount} item{cartCount===1?'':'s'} in your basket</Text>
            {cart.map(item=><View key={item.id} style={styles.checkoutSummaryProduct}><View style={styles.checkoutSummaryThumb}>{item.image_url?<Image source={{uri:optimizedImageUrl(item.image_url, 240, 70)}} resizeMode="contain" style={{width:'100%',height:'100%'}}/>:<Ionicons name={item.icon||'medical-outline'} size={20} color={COLORS.green}/>}</View><View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={styles.checkoutSummaryProductName}>{item.name}</Text><Text style={styles.checkoutSummaryProductMeta}>Qty {item.qty} × {money(item.price)}</Text></View><Text style={styles.checkoutSummaryProductPrice}>{money(item.price*item.qty)}</Text></View>)}
            <View style={styles.summaryDivider}/>
            <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>{money(total)}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Delivery fee</Text><Text style={styles.summaryValuePending}>{orderType==='Delivery'?'To be confirmed':'Not applicable'}</Text></View>
            <View style={styles.summaryDivider}/>
            <View style={styles.summaryTotalLine}><Text style={styles.summaryTotalLabel}>Total before delivery</Text><Text style={styles.summaryTotalValue}>{money(total)}</Text></View>
            <Text style={styles.summaryNote}>No payment is taken here. The pharmacy will confirm availability, final charges and next steps.</Text>
            <ActionButton title={orderBusy ? 'Submitting order…' : 'Submit order request'} onPress={placeOrder} disabled={orderBusy || !cart.length}/>
            <View style={styles.summarySecure}><Ionicons name="shield-checkmark-outline" size={16} color={COLORS.green}/><Text style={styles.summarySecureText}>Order requests are subject to pharmacy confirmation.</Text></View>
          </View>
        </View>
      )}
    </View>
  );

  const Account = ({ compact = false } = {}) => (
    <>
      {!compact && <><Text style={styles.pageTitle}>Your account</Text><Text style={styles.pageSubtitle}>Your Kanev Pharmacy customer space.</Text></>}
      {!supabaseConfigured ? <View style={styles.formCard}><Text style={styles.accountHeading}>Account services unavailable</Text><Text style={styles.accountCopy}>We’re unable to connect to account services right now. Please try again later or contact Kanev Pharmacy for help.</Text></View> : !session ? <View style={[styles.authShell, isDesktop && styles.authShellDesktop]}>
        {isDesktop && <ImageBackground source={loginBranding.left_background_image_url ? { uri: loginBranding.left_background_image_url } : undefined} imageStyle={{ opacity: loginBranding.left_background_image_url ? 1 : 0 }} style={[styles.authPromoPanel, { backgroundColor: loginBranding.left_background_color || '#0B4B38' }]}>
          <View style={styles.authPromoCircle}>
            <Image source={loginBranding.logo_left_url ? { uri: loginBranding.logo_left_url } : KanevPharmacySymbol} resizeMode="contain" style={styles.authOfficialSymbolLogo} />
          </View>
          <Text style={[styles.authPromoTitle,{fontSize:Number(loginBranding.left_heading_size)||29,fontFamily:loginBranding.left_heading_font_family==="System"?undefined:loginBranding.left_heading_font_family,color:loginBranding.left_heading_color||"#FFFFFF",fontWeight:loginBranding.left_heading_style==="normal"?"400":"900",fontStyle:loginBranding.left_heading_style==="italic"?"italic":"normal"}]}>{loginBranding.left_heading || loginBranding.pharmacy_title}</Text>
          <Text style={[styles.authPromoCopy,{fontSize:Number(loginBranding.left_description_size)||13,fontFamily:loginBranding.left_description_font_family==="System"?undefined:loginBranding.left_description_font_family,color:loginBranding.left_description_color||"#D8EAE2",fontWeight:loginBranding.left_description_style==="bold"?"700":"400",fontStyle:loginBranding.left_description_style==="italic"?"italic":"normal"}]}>{loginBranding.left_description}</Text>
          <View style={styles.authBenefit}><Ionicons name="shield-checkmark-outline" size={19} color="#D4F879"/><Text style={[styles.authBenefitText,{fontSize:Number(loginBranding.benefit_size)||12,fontFamily:loginBranding.benefit_font_family==="System"?undefined:loginBranding.benefit_font_family,color:loginBranding.benefit_color||"#F2FBF5",fontWeight:loginBranding.benefit_style==="normal"?"400":"700",fontStyle:loginBranding.benefit_style==="italic"?"italic":"normal"}]}>{loginBranding.benefit_one}</Text></View>
          <View style={styles.authBenefit}><Ionicons name="bag-check-outline" size={19} color="#D4F879"/><Text style={[styles.authBenefitText,{fontSize:Number(loginBranding.benefit_size)||12,fontFamily:loginBranding.benefit_font_family==="System"?undefined:loginBranding.benefit_font_family,color:loginBranding.benefit_color||"#F2FBF5",fontWeight:loginBranding.benefit_style==="normal"?"400":"700",fontStyle:loginBranding.benefit_style==="italic"?"italic":"normal"}]}>{loginBranding.benefit_two}</Text></View>
          <View style={styles.authBenefit}><Ionicons name="heart-outline" size={19} color="#D4F879"/><Text style={[styles.authBenefitText,{fontSize:Number(loginBranding.benefit_size)||12,fontFamily:loginBranding.benefit_font_family==="System"?undefined:loginBranding.benefit_font_family,color:loginBranding.benefit_color||"#F2FBF5",fontWeight:loginBranding.benefit_style==="normal"?"400":"700",fontStyle:loginBranding.benefit_style==="italic"?"italic":"normal"}]}>{loginBranding.benefit_three}</Text></View>
        </ImageBackground>}
        <View style={styles.authFormPanel}>
          <View style={styles.authBrandMini}>
            <Image source={loginBranding.logo_form_url ? { uri: loginBranding.logo_form_url } : KanevPharmacySymbol} resizeMode="contain" style={styles.authOfficialFormSymbolLogo} />
            <Text style={[styles.authBrandName,{fontSize:Number(loginBranding.brand_title_size)||15,fontFamily:loginBranding.brand_title_font_family==="System"?undefined:loginBranding.brand_title_font_family,color:loginBranding.brand_title_color||"#0B4B38",fontWeight:loginBranding.brand_title_style==="normal"?"400":"900",fontStyle:loginBranding.brand_title_style==="italic"?"italic":"normal"}]}>{loginBranding.pharmacy_title}</Text>
            <Text style={[styles.authBrandTag,{fontSize:Number(loginBranding.tagline_size)||10,fontFamily:loginBranding.tagline_font_family==="System"?undefined:loginBranding.tagline_font_family,color:loginBranding.tagline_color||"#246EB0",fontWeight:loginBranding.tagline_style==="bold"?"700":"400",fontStyle:loginBranding.tagline_style==="italic"?"italic":"normal"}]}>{loginBranding.tagline}</Text>
          </View>
          <Text style={[styles.authEyebrow,{fontSize:Number(loginBranding.right_eyebrow_size)||10,fontFamily:loginBranding.right_eyebrow_font_family==="System"?undefined:loginBranding.right_eyebrow_font_family,color:loginBranding.right_eyebrow_color||"#16805B",fontWeight:loginBranding.right_eyebrow_style==="normal"?"400":"900",fontStyle:loginBranding.right_eyebrow_style==="italic"?"italic":"normal"}]}>{authMode === 'signup' ? 'JOIN KANEV' : 'WELCOME BACK'}</Text>
          <Text style={[styles.accountHeading,{fontSize:Number(loginBranding.right_heading_size)||18,fontFamily:loginBranding.right_heading_font_family==="System"?undefined:loginBranding.right_heading_font_family,color:loginBranding.right_heading_color||"#172B24",fontWeight:loginBranding.right_heading_style==="normal"?"400":"900",fontStyle:loginBranding.right_heading_style==="italic"?"italic":"normal"}]}>{authMode === 'signup' ? 'Create your account' : 'Login / Sign up'}</Text>
          <Text style={[styles.authIntro,{fontSize:Number(loginBranding.right_intro_size)||12,fontFamily:loginBranding.right_intro_font_family==="System"?undefined:loginBranding.right_intro_font_family,color:loginBranding.right_intro_color||"#718078",fontWeight:loginBranding.right_intro_style==="bold"?"700":"400",fontStyle:loginBranding.right_intro_style==="italic"?"italic":"normal"}]}>{authMode === 'signup' ? 'Create an account to make ordering and tracking easier.' : ''}</Text>
          {authMode === 'signup' ? <>
            <Text style={styles.fieldLabel}>Full name</Text><View style={styles.authInputWrap}><Ionicons name="person-outline" size={19} color="#789087"/><TextInput value={authName} onChangeText={setAuthName} placeholder="Enter your full name" autoCapitalize="words" style={styles.authInput} /></View>
            <Text style={styles.fieldLabel}>Email address</Text><View style={styles.authInputWrap}><Ionicons name="mail-outline" size={19} color="#789087"/><TextInput value={authEmail} onChangeText={setAuthEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" style={styles.authInput} /></View>
            <Text style={styles.fieldLabel}>Mobile number</Text><View style={styles.authInputWrap}><Ionicons name="phone-portrait-outline" size={19} color="#789087"/><TextInput value={authPhone} onChangeText={setAuthPhone} keyboardType="phone-pad" placeholder="0977 123 456 or +260..." style={styles.authInput} /></View>
          </> : <><Text style={styles.fieldLabel}>Email address or mobile number</Text><View style={styles.authInputWrap}><Ionicons name="person-outline" size={19} color="#789087"/><TextInput value={authIdentifier} onChangeText={setAuthIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com or 0977 123 456" style={styles.authInput} /></View></>}
          <Text style={styles.fieldLabel}>Password <Text style={styles.authFieldHint}>(minimum 6 characters)</Text></Text><View style={styles.authInputWrap}><Ionicons name="lock-closed-outline" size={19} color="#789087"/><TextInput value={authPassword} onChangeText={setAuthPassword} secureTextEntry placeholder="Enter your password" style={styles.authInput} /></View>
          <Pressable onPress={() => notify('Password help', 'Please contact Kanev Pharmacy for account recovery. A secure self-service reset flow can be added before launch.')} style={styles.authForgot}><Text style={styles.authForgotText}>Forgot password?</Text></Pressable>
          <Pressable onPress={handleAuth} disabled={authBusy} style={[styles.authSubmit, authBusy && {opacity:0.6}]}><Text style={styles.authSubmitText}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Continue securely'}</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF"/></Pressable>
          <View style={styles.authSwitchRow}><Text style={styles.authSwitchCopy}>{authMode === 'signup' ? 'Already have an account?' : 'New to Kanev Pharmacy?'}</Text><Pressable onPress={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}><Text style={styles.authSwitchLink}>{authMode === 'signup' ? ' Sign in' : ' Create account'}</Text></Pressable></View>
          
        </View>
      </View> : <>
        <View style={[styles.myAccountHero, isDesktop && styles.myAccountHeroDesktop, !isDesktop && {padding:15,borderRadius:18,marginBottom:14}]}>
          <View style={[styles.myAccountGreetingRow,!isDesktop&&{flexWrap:'nowrap',alignItems:'center',gap:10}]}>
            <View style={[styles.myAccountAvatarWrap,!isDesktop&&{minWidth:58,marginRight:0}]}>
              <Pressable onPress={updateProfilePhoto} disabled={avatarBusy} accessibilityRole="button" accessibilityLabel="Change profile photo" style={[styles.myAccountAvatar,!isDesktop&&{width:54,height:54,borderRadius:27,borderWidth:2}, avatarBusy && { opacity: 0.6 }]}>
                {session.user.user_metadata?.avatar_url
                  ? <Image source={{ uri: session.user.user_metadata.avatar_url }} style={styles.myAccountAvatarPhoto} resizeMode="cover" />
                  : <Text style={styles.myAccountAvatarText}>{(session.user.user_metadata?.full_name || session.user.email || 'K').trim().charAt(0).toUpperCase()}</Text>}
                <View style={styles.myAccountAvatarCamera}><Ionicons name={avatarBusy ? 'hourglass-outline' : 'camera'} size={14} color="#FFFFFF" /></View>
              </Pressable>
              <Pressable onPress={updateProfilePhoto} disabled={avatarBusy}><Text style={styles.myAccountAvatarAction}>{avatarBusy ? 'Saving photo…' : session.user.user_metadata?.avatar_url ? 'Change photo' : 'Add photo'}</Text></Pressable>
              {session.user.user_metadata?.avatar_url ? <Pressable onPress={removeProfilePhoto} disabled={avatarBusy}><Text style={styles.myAccountAvatarRemove}>Remove</Text></Pressable> : null}
            </View>
            <View style={{flex:1,minWidth:0}}><Text style={[styles.myAccountEyebrow,!isDesktop&&{fontSize:8,letterSpacing:1,marginBottom:3}]}>KANEV PHARMACY · MY ACCOUNT</Text><Text style={[styles.myAccountWelcome,!isDesktop&&{fontSize:20,lineHeight:24}]}>Hello, {session.user.user_metadata?.full_name?.trim()?.split(/\s+/)[0] || 'there'}</Text><Text style={[styles.myAccountSub,!isDesktop&&{fontSize:10,lineHeight:14,marginTop:2}]}>Manage your account and pharmacy services</Text></View>
            <Pressable style={[styles.myAccountSignOut,!isDesktop&&{paddingHorizontal:9,paddingVertical:8,marginLeft:0,borderRadius:9}]} onPress={signOut}><Ionicons name="log-out-outline" size={17} color="#B42332"/><Text style={styles.myAccountSignOutText}>Sign out</Text></Pressable>
          </View>
          <View style={[styles.myAccountTrustLine,!isDesktop&&{marginTop:12,paddingTop:10,gap:6}]}><Ionicons name="shield-checkmark-outline" size={16} color="#D4F879"/><Text style={[styles.myAccountTrustText,!isDesktop&&{fontSize:10} ]}>Your Kanev account, handled securely</Text>{isDesktop && <Text style={styles.myAccountTagline}>Closer to Your Health</Text>}</View>
        </View>
        <View style={[styles.myAccountLayout, isDesktop && styles.myAccountLayoutDesktop]}>
          <View style={[styles.myAccountSidebar,isDesktop&&{width:250,flexShrink:0}]}>
            <Text style={styles.myAccountMenuHeading}>MY ACCOUNT</Text>
            {[['person-outline','Profile','profile'],['cube-outline','My Orders','orders'],['document-text-outline','Prescriptions','prescriptions'],['cart-outline','My Cart','cart'],['help-circle-outline','Help & Support','support']].map(([icon,label,key])=><Pressable key={key} onPress={()=>{if(key==='cart'){setTab('Cart');return;}if(key==='orders'){if(!isDesktop){setTab('Orders');return;}setAccountSection('orders');return;}if(key==='profile'){setAccountSection('profile');return;}if(key==='prescriptions'){setTab('HealthDocuments');return;}notify('Kanev Pharmacy support','Please contact the pharmacy team for help with your account, orders or prescriptions.');}} style={[styles.myAccountMenuItem,accountSection===key&&styles.myAccountMenuItemActive]}><Ionicons name={icon} size={19} color={accountSection===key?COLORS.blue:COLORS.muted}/><Text style={[styles.myAccountMenuText,accountSection===key&&styles.myAccountMenuTextActive]}>{label}</Text>{key==='orders'&&orders.length>0?<View style={styles.myAccountCount}><Text style={styles.myAccountCountText}>{orders.length}</Text></View>:null}{key==='prescriptions'&&healthDocuments.filter(d=>(healthDocMessages[d.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[d.id]||[]).slice(-1)[0]?.read_at).length>0?<View style={[styles.myAccountCount,{backgroundColor:'#DBEAFE',borderWidth:1,borderColor:'#93C5FD'}]}><Text style={[styles.myAccountCountText,{color:'#1D4ED8'}]}>{healthDocuments.filter(d=>(healthDocMessages[d.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[d.id]||[]).slice(-1)[0]?.read_at).length}</Text></View>:null}</Pressable>)}
            <View style={styles.myAccountSidebarFooter}><Ionicons name="heart-outline" size={18} color={COLORS.green}/><Text style={styles.myAccountSidebarFooterText}>Here for your everyday health.</Text></View>
          </View>
          <View style={styles.myAccountMain}>
            {accountSection==='orders' ? <><View style={styles.myAccountSectionHeader}><View><Text style={styles.myAccountSectionTitle}>My Orders</Text><Text style={styles.myAccountSectionSub}>Review your recent order requests</Text></View><Pressable onPress={()=>openStoreShop('All')}><Text style={styles.myAccountTextLink}>Shop products  →</Text></Pressable></View>{orders.length===0?<View style={styles.myAccountEmpty}><View style={styles.myAccountEmptyIcon}><Ionicons name="cube-outline" size={27} color={COLORS.green}/></View><Text style={styles.myAccountEmptyTitle}>No orders yet</Text><Text style={styles.myAccountEmptyCopy}>When you submit an order request, it will appear here so you can check its status.</Text><ActionButton title="Browse products" onPress={()=>openStoreShop('All')}/></View>:orders.map(o=>{
              const isExpanded = expandedCustomerOrderId === o.id;
              const trackingLabel = o.tracking_code || o.order_number || 'View order details';
              return <View key={o.id} style={[styles.myAccountOrderRow,{alignItems:'flex-start'}]}>
                <View style={styles.myAccountOrderIcon}><Ionicons name="receipt-outline" size={21} color={COLORS.green}/></View>
                <View style={{flex:1,minWidth:0}}>
                  <Text style={styles.accountRowTitle}>{o.order_number||'Order request'}</Text>
                  <Text style={styles.accountRowSub}>{String(o.delivery_status||o.status||'pending').replaceAll('_',' ')} · {o.fulfilment||'Collection / delivery'}</Text>
                  <Pressable onPress={()=>setExpandedCustomerOrderId(current=>current===o.id?null:o.id)} accessibilityRole="button" accessibilityLabel={`${isExpanded?'Hide':'View'} tracking details for ${trackingLabel}`} style={{marginTop:7,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingVertical:5,paddingHorizontal:8,borderRadius:7,backgroundColor:'#EAF5EE',maxWidth:'100%'}}>
                    <Ionicons name="navigate-outline" size={14} color={COLORS.green}/>
                    <Text style={{fontSize:12,color:COLORS.green,fontWeight:'900',flexShrink:1}}>{o.tracking_code ? `Tracking ID: ${o.tracking_code}` : `Order details: ${o.order_number||'View order'}`}</Text>
                    <Ionicons name={isExpanded?'chevron-up':'chevron-down'} size={15} color={COLORS.green}/>
                  </Pressable>
                  {isExpanded ? <View style={{marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:'#DCE8E1'}}>
                    {o.delivery_partner ? <Text style={styles.accountRowSub}>Courier: {o.delivery_partner}</Text> : null}
                    <KanevOrderProgress status={o.status || o.delivery_status} fulfilment={o.fulfilment} />
                    {(orderTrackingEvents[o.id] || []).filter(ev => !/^order status changed\s/i.test(String(ev.message || '').trim())).length > 0 ? <View style={{marginTop:10,paddingLeft:10,borderLeftWidth:2,borderLeftColor:'#C8DCCF',gap:7}}>
                      {(orderTrackingEvents[o.id] || []).filter(ev => !/^order status changed\s/i.test(String(ev.message || '').trim())).slice(0,4).map(ev=><View key={ev.id}><Text style={{fontSize:11,fontWeight:'800',color:COLORS.ink}}>{ev.message}</Text><Text style={{fontSize:10,color:COLORS.muted}}>{new Date(ev.created_at).toLocaleString()}{ev.location ? ` · ${ev.location}` : ''}</Text></View>)}
                    </View> : <Text style={[styles.accountRowSub,{marginTop:8}]}>Progress updates will appear here as the pharmacy processes your order.</Text>}
                  </View> : null}
                  <Text style={[styles.accountRowSub,{marginTop:5}]}>{new Date(o.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.price}>{money(o.total_zmw)}</Text>
              </View>;
            })}</> : accountSection==='prescriptions' ? <>
              <View style={styles.myAccountSectionHeader}><View><Text style={styles.myAccountSectionTitle}>{activeDocType === 'lab_result' ? 'Lab Test Results' : activeDocType === 'prescription' ? 'Prescriptions' : 'Prescriptions & lab results'}</Text><Text style={styles.myAccountSectionSub}>{activeDocType === 'lab_result' ? 'Upload lab results and follow the pharmacy review.' : activeDocType === 'prescription' ? 'Upload prescriptions and follow the pharmacy review.' : 'Upload documents securely and follow the pharmacy\'s review.'}</Text></View></View>
              <View style={{padding:14,borderRadius:12,backgroundColor:'#F0F7F2',borderWidth:1,borderColor:COLORS.border,marginBottom:14}}>
                <Text style={styles.myAccountQuickTitle}>Prepare your submission</Text>
                <View style={{flexDirection:isDesktop?'row':'column',gap:14,marginTop:12,alignItems:'stretch'}}>
                  <View style={{flex:isDesktop?1:undefined,minHeight:250,borderRadius:12,borderWidth:1,borderColor:'#D5E4DA',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',padding:12,overflow:'hidden'}}>
                    {selectedHealthAsset ? (selectedHealthAsset.mimeType?.startsWith('image/') ? <Image source={{uri:selectedHealthAsset.uri}} resizeMode="contain" style={{width:'100%',height:280}} /> : <View style={{alignItems:'center',gap:10,padding:20}}><Ionicons name="document-text" size={74} color={COLORS.green}/><Text style={{fontSize:14,fontWeight:'900',color:COLORS.ink,textAlign:'center'}}>PDF preview</Text><Text style={{fontSize:12,color:COLORS.muted,textAlign:'center'}}>The selected PDF is ready to submit.</Text></View>) : <View style={{alignItems:'center',gap:10,padding:20}}><View style={{width:76,height:76,borderRadius:20,backgroundColor:'#E5F3EA',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={38} color={COLORS.green}/></View><Text style={{fontSize:14,fontWeight:'900',color:COLORS.ink}}>Document preview</Text><Text style={{fontSize:12,color:COLORS.muted,textAlign:'center',lineHeight:18}}>Choose a photo or PDF. Your image will appear here before you submit.</Text></View>}
                  </View>
                  <View style={{flex:isDesktop?1:undefined,gap:9,minWidth:0}}>
                    <Text style={styles.myAccountQuickTitle}>Document details</Text>
                    {!activeDocType && <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[['prescription','Prescription','document-text-outline'],['lab_result','Lab result','flask-outline']].map(([value,label,icon])=><Pressable key={value} onPress={()=>setHealthDocType(value)} style={{padding:10,borderRadius:9,borderWidth:1,borderColor:healthDocType===value?COLORS.green:COLORS.border,backgroundColor:healthDocType===value?'#E0F2E8':'#fff',flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name={icon} size={17} color={COLORS.green}/><Text style={{fontSize:12,fontWeight:'800',color:COLORS.green}}>{label}</Text></Pressable>)}</View>}
                    <TextInput value={healthDocTitle} onChangeText={setHealthDocTitle} placeholder="Title (optional)" placeholderTextColor={COLORS.muted} style={styles.fieldInput} />
                    <TextInput value={healthDocNotes} onChangeText={setHealthDocNotes} placeholder="Note for the pharmacy (optional)" placeholderTextColor={COLORS.muted} multiline style={[styles.fieldInput,{minHeight:90,textAlignVertical:'top'}]} />
                    <Text style={{fontSize:11,color:COLORS.muted,lineHeight:16}}>PDF, JPG, PNG or WebP · Maximum 10 MB. Only you and authorized pharmacy staff can access the uploaded file.</Text>
                    {selectedHealthAsset ? <View style={{padding:10,borderRadius:9,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name={selectedHealthAsset.mimeType==='application/pdf'?'document-text-outline':'image-outline'} size={20} color={COLORS.green}/><Text numberOfLines={2} style={{fontSize:12,color:COLORS.ink,flex:1}}>{selectedHealthAsset.name}</Text><Pressable onPress={()=>setSelectedHealthAsset(null)} accessibilityLabel="Remove selected file"><Ionicons name="close-circle" size={20} color={COLORS.muted}/></Pressable></View> : null}
                    <ActionButton title={selectedHealthAsset ? 'Change selected file' : 'Choose file to preview'} secondary onPress={chooseHealthDocumentFile} disabled={healthDocUploading}/>
                    <ActionButton title={healthDocUploading?'Submitting securely…':'Submit document'} onPress={uploadHealthDocument} disabled={healthDocUploading||!selectedHealthAsset}/>
                    <Text style={{fontSize:10,color:COLORS.muted}}>Nothing is uploaded until you press Submit document.</Text>
                  </View>
                </View>
              </View>
              <View style={styles.myAccountSectionHeader}><View><Text style={styles.myAccountSectionTitle}>My submissions</Text><Text style={styles.myAccountSectionSub}>Feedback and status updates from Kanev Pharmacy</Text></View><Text style={styles.myAccountSectionSub}>Updates automatically</Text></View>
              {visibleHealthDocuments.length===0?<View style={styles.myAccountEmpty}><View style={styles.myAccountEmptyIcon}><Ionicons name="document-text-outline" size={27} color={COLORS.green}/></View><Text style={styles.myAccountEmptyTitle}>No documents submitted</Text><Text style={styles.myAccountEmptyCopy}>{activeDocType === 'lab_result' ? 'Your submitted lab results will appear here with review updates.' : activeDocType === 'prescription' ? 'Your submitted prescriptions will appear here with review updates.' : 'Your uploaded prescriptions and lab results will appear here with review updates.'}</Text></View>:visibleHealthDocuments.map(doc=>{
                const messages=healthDocMessages[doc.id]||[], closed=!!doc.conversation_closed_at;
                const expanded = expandedHealthDocumentId === doc.id;
                return <View key={doc.id} style={[styles.myAccountOrderRow,{alignItems:'stretch',marginBottom:8,paddingVertical:0}]}>
                  <Pressable onPress={()=>toggleHealthDocument(doc,expanded)} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:11}}>
                    <View style={[styles.myAccountOrderIcon,{width:36,height:36}]}><Ionicons name={doc.document_type==='prescription'?'document-text-outline':'flask-outline'} size={19} color={COLORS.green}/></View>
                    <View style={{flex:1,minWidth:0,gap:3}}>
                      <Text style={styles.accountRowTitle}>{healthDocumentNumber(doc)}</Text>
                      <Text style={styles.accountRowSub}>{new Date(doc.created_at).toLocaleString()}</Text>
                    </View>
                    <View style={{alignItems:'flex-end',gap:4}}><View style={{paddingHorizontal:8,paddingVertical:5,borderRadius:7,backgroundColor:doc.status==='completed'?'#E0F2E8':'#EEF1EF'}}><Text style={{fontSize:10,fontWeight:'900',color:COLORS.green}}>{String(doc.status||'submitted').replaceAll('_',' ')}</Text></View>{(healthDocMessages[doc.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[doc.id]||[]).slice(-1)[0]?.read_at?<View style={{paddingHorizontal:8,paddingVertical:4,borderRadius:7,backgroundColor:'#DBEAFE',borderWidth:1,borderColor:'#93C5FD'}}><Text style={{fontSize:9,fontWeight:'900',color:'#1D4ED8'}}>NEW REPLY</Text></View>:null}</View>
                    <Ionicons name={expanded?'chevron-up':'chevron-down'} size={17} color={COLORS.muted}/>
                  </Pressable>
                  {expanded ? <View style={{paddingBottom:12,gap:7}}>
                    <Text style={styles.accountRowSub}>{doc.document_type==='prescription'?'Prescription':'Lab result'}{doc.title?` · ${doc.title}`:''}</Text>
                    <Text style={styles.accountRowSub}>File: {doc.file_name||'Uploaded document'}</Text>
                    {doc.preview_url ? (() => { const mime=String(doc.mime_type||'').toLowerCase(); const name=String(doc.file_name||'').toLowerCase(); const isImage=mime.startsWith('image/')||/\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name); const isPdf=mime.includes('pdf')||name.endsWith('.pdf'); return <View style={{marginTop:6,marginBottom:8,padding:10,borderRadius:12,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,gap:8}}>{isImage ? <Image source={{uri:doc.preview_url}} resizeMode="contain" style={{width:'100%',height:260,borderRadius:8,backgroundColor:'#F4F7F5'}}/> : <View style={{flexDirection:'row',alignItems:'center',gap:9}}><Ionicons name={isPdf?'document-text-outline':'document-outline'} size={26} color={COLORS.green}/><View style={{flex:1}}><Text style={{fontSize:12,fontWeight:'800',color:COLORS.ink}}>{isPdf?'PDF document':'Uploaded file'}</Text><Text style={styles.accountRowSub}>Open the original file to view its contents.</Text></View></View>}<ActionButton title={isImage?'Open full document':isPdf?'Open PDF':'Open uploaded file'} secondary onPress={()=>Linking.openURL(doc.preview_url).catch(()=>notify('Could not open file','Please try again or contact the pharmacy.','error'))}/></View>})() : <View style={{marginTop:6,marginBottom:8,padding:10,borderRadius:10,backgroundColor:'#FFF8E8',borderWidth:1,borderColor:'#EAD9A8'}}><Text style={{fontSize:12,color:'#765B20'}}>The uploaded file preview is unavailable. Please contact the pharmacy if you need this document retrieved.</Text></View>}
                    <View style={{marginTop:4,padding:12,borderRadius:12,backgroundColor:'#F7FAF8',borderWidth:1,borderColor:COLORS.border}}>
                      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8}}><View style={{flexDirection:'row',alignItems:'center',gap:7,flex:1}}><Ionicons name="chatbubbles-outline" size={18} color={COLORS.green}/><Text style={{fontSize:12,fontWeight:'900',color:COLORS.ink}}>Pharmacy conversation</Text></View><Text style={{fontSize:10,fontWeight:'900',color:closed?COLORS.muted:COLORS.green}}>{closed?'CLOSED':'OPEN'}</Text></View>
                      {messages.length===0?<Text style={styles.accountRowSub}>No messages yet. The pharmacy will reply here after reviewing your document.</Text>:<View style={{gap:9,marginBottom:10}}>{messages.map(m=>{const own=m.sender_role==='customer';return <View key={m.id} style={{alignSelf:own?'flex-end':'flex-start',maxWidth:'92%',padding:10,borderRadius:12,backgroundColor:own?'#DDF4E6':'#FFFFFF',borderWidth:1,borderColor:own?'#C2E4D0':'#DCE8E1'}}><Text style={{fontSize:10,fontWeight:'900',color:COLORS.green,marginBottom:4}}>{own?'YOU':'KANEV PHARMACY'}</Text><Text style={{fontSize:12,color:COLORS.ink,lineHeight:18}}>{m.message}</Text><Text style={{fontSize:10,color:COLORS.muted,marginTop:5}}>{new Date(m.created_at).toLocaleString()}</Text></View>;})}</View>}
                      {closed?<View style={{flexDirection:'row',gap:7,padding:10,borderRadius:9,backgroundColor:'#ECEFEC'}}><Ionicons name="lock-closed-outline" size={16} color={COLORS.muted}/><Text style={{flex:1,fontSize:11,color:COLORS.muted,lineHeight:16}}>The pharmacy has closed this conversation. You can no longer reply.</Text></View>:<><TextInput value={healthDocReplyDrafts[doc.id]||''} onChangeText={v=>setHealthDocReplyDrafts(prev=>({...prev,[doc.id]:v}))} placeholder="Reply to Kanev Pharmacy…" placeholderTextColor={COLORS.muted} multiline style={[styles.fieldInput,{minHeight:68,textAlignVertical:'top',marginTop:2,marginBottom:8,backgroundColor:'#FFFFFF'}]}/><ActionButton title={healthDocSendingId===doc.id?'Sending reply…':'Send reply'} onPress={()=>sendHealthDocumentReply(doc)} disabled={healthDocSendingId===doc.id||!(healthDocReplyDrafts[doc.id]||'').trim()}/></>}
                    </View>
                  </View> : null}
                </View>;
              })}
            </> : <>
              <View style={styles.myAccountSectionHeader}><View><Text style={styles.myAccountSectionTitle}>Personal Information</Text><Text style={styles.myAccountSectionSub}>Your account details at a glance</Text></View><View style={styles.myAccountAccountNumber}><Text style={styles.myAccountAccountNumberLabel}>ACCOUNT</Text><Text style={styles.myAccountAccountNumberValue}>{session.user.id ? `…${session.user.id.slice(-6).toUpperCase()}` : 'CUSTOMER'}</Text></View></View>
              <View style={styles.myAccountInfoGrid}>
                {[['person-outline','FULL NAME',session.user.user_metadata?.full_name||'Add your name during registration'],['mail-outline','EMAIL ADDRESS',session.user.email||'Not provided'],['call-outline','PHONE NUMBER',session.user.phone||session.user.user_metadata?.phone||'Not provided'],['calendar-outline','MEMBER SINCE',session.user.created_at?new Date(session.user.created_at).toLocaleDateString():'Kanev Pharmacy customer']].map(([icon,label,value])=><View key={label} style={styles.myAccountInfoCell}><View style={styles.myAccountInfoIcon}><Ionicons name={icon} size={17} color={COLORS.blue}/></View><View style={{flex:1,minWidth:0}}><Text style={styles.myAccountInfoLabel}>{label}</Text><Text style={styles.myAccountInfoValue}>{value}</Text></View></View>)}
              </View>
              <View style={styles.myAccountSectionHeader}><View><Text style={styles.myAccountSectionTitle}>Quick Access</Text><Text style={styles.myAccountSectionSub}>Your pharmacy services in one place</Text></View><Text style={styles.myAccountSmallNote}>Manage your services</Text></View>
              <View style={styles.myAccountQuickGrid}>
                {[['cube-outline','My Orders','View your online order requests',()=>{if(!isDesktop){setTab('Orders');return;}setAccountSection('orders');}],['document-text-outline','Prescriptions','Upload and track prescription review',()=>{setHealthDocType('prescription');setTab(isDesktop?'HealthDocuments':'Prescriptions');}],['flask-outline','Lab Results','Upload results and receive feedback',()=>{setHealthDocType('lab_result');setTab(isDesktop?'HealthDocuments':'LabResults');}],['cart-outline','My Cart','Continue shopping',()=>setTab('Cart')]].map(([icon,title,sub,action])=><Pressable key={title} style={styles.myAccountQuickCard} onPress={action}><View style={styles.myAccountQuickIcon}><Ionicons name={icon} size={22} color={COLORS.blue}/></View><View style={{flex:1,minWidth:0}}><Text style={styles.myAccountQuickTitle}>{title}</Text><Text style={styles.myAccountQuickSub}>{sub}</Text></View><Ionicons name="chevron-forward" size={18} color={COLORS.muted}/></Pressable>)}
              </View>
              <View style={styles.myAccountHelpBanner}><View style={styles.myAccountHelpIcon}><Ionicons name="chatbubbles-outline" size={22} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.myAccountQuickTitle}>Need a hand?</Text><Text style={styles.myAccountQuickSub}>Our team can help with orders, product availability and prescription questions.</Text></View><Pressable onPress={()=>notify('Kanev Pharmacy support','Please contact the pharmacy team for assistance with your account or an order.')}><Text style={styles.myAccountTextLink}>Get help</Text></Pressable></View>
            </>}
          </View>
        </View>
      </>}
      {!compact && <View style={styles.disclaimer}><Ionicons name="information-circle-outline" size={20} color={COLORS.green} /><Text style={styles.disclaimerText}>This app does not replace professional medical advice. Product dispensing is subject to pharmacy review.</Text></View>}
    </>
  );

  const CustomerOrdersPage = () => {
    if(!session?.user)return <View style={styles.formCard}><Text style={styles.accountHeading}>Sign in required</Text><Text style={styles.accountCopy}>Sign in to view and manage your orders.</Text><ActionButton title="Sign in" onPress={()=>{setAuthMode('signin');setAuthModalVisible(true);setTab('Account');}}/></View>;
    const activeCount=orders.filter(o=>!['delivered','cancelled','completed'].includes(String(o.delivery_status||o.status||'').toLowerCase())).length;
    return <View style={{width:'100%',gap:10}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <Pressable onPress={()=>setTab('Account')} style={{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:7}}><Ionicons name="arrow-back" size={19} color={COLORS.green}/><Text style={{fontSize:13,fontWeight:'800',color:COLORS.green}}>My account</Text></Pressable>
        <Pressable onPress={loadOrders} style={{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:8,paddingHorizontal:12,borderRadius:20,backgroundColor:'#EAF5EE'}}><Ionicons name="refresh-outline" size={16} color={COLORS.green}/><Text style={{fontSize:12,fontWeight:'800',color:COLORS.green}}>Refresh</Text></Pressable>
      </View>
      <View style={{backgroundColor:COLORS.green,borderRadius:11,paddingHorizontal:13,paddingVertical:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <Text style={{fontSize:17,fontWeight:'900',color:'#FFFFFF'}}>My Orders</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:13}}>
          <Text style={{fontSize:11,fontWeight:'700',color:'#E4F2E9'}}>{orders.length} total</Text>
          <View style={{width:1,height:19,backgroundColor:'rgba(255,255,255,0.35)'}}/>
          <Text style={{fontSize:11,fontWeight:'700',color:'#E4F2E9'}}>{activeCount} in progress</Text>
        </View>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:17,fontWeight:'900',color:COLORS.ink}}>Order history</Text><Pressable onPress={()=>openStoreShop('All')}><Text style={{fontSize:12,fontWeight:'900',color:COLORS.blue}}>Shop products  →</Text></Pressable></View>
      {!orders.length?<View style={styles.myAccountEmpty}><View style={styles.myAccountEmptyIcon}><Ionicons name="cube-outline" size={27} color={COLORS.green}/></View><Text style={styles.myAccountEmptyTitle}>No orders yet</Text><Text style={styles.myAccountEmptyCopy}>Your submitted order requests will appear here with their status and tracking updates.</Text><ActionButton title="Browse products" onPress={()=>openStoreShop('All')}/></View>:orders.map(o=>{
        const isExpanded=expandedCustomerOrderId===o.id;
        const status=String(o.delivery_status||o.status||'pending').replaceAll('_',' ');
        return <View key={o.id} style={{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:10,padding:9,gap:6}}>
          <View style={{flexDirection:'row',alignItems:'flex-start',gap:10}}>
            <View style={{width:34,height:34,borderRadius:10,backgroundColor:'#EAF5EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="receipt-outline" size={21} color={COLORS.green}/></View>
            <View style={{flex:1,minWidth:0,gap:4}}><Text style={{fontSize:13,fontWeight:'900',color:COLORS.ink}}>{o.order_number||'Order request'}</Text><Text style={{fontSize:11,color:COLORS.muted}}>{new Date(o.created_at).toLocaleDateString()} · {o.fulfilment||'Collection / delivery'}</Text><View style={{alignSelf:'flex-start',backgroundColor:'#EAF5EE',paddingHorizontal:9,paddingVertical:5,borderRadius:20}}><Text style={{fontSize:11,fontWeight:'900',color:COLORS.green,textTransform:'capitalize'}}>{status}</Text></View></View>
            <Text style={{fontSize:14,fontWeight:'900',color:COLORS.green}}>{money(o.total_zmw)}</Text>
          </View>
          <Pressable onPress={()=>setExpandedCustomerOrderId(current=>current===o.id?null:o.id)} style={{borderTopWidth:1,borderTopColor:'#EDF2EE',paddingTop:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name="navigate-outline" size={16} color={COLORS.blue}/><Text style={{fontSize:12,fontWeight:'800',color:COLORS.blue}}>{isExpanded?'Hide order progress':'View order progress'}</Text></View><Ionicons name={isExpanded?'chevron-up':'chevron-down'} size={17} color={COLORS.blue}/></Pressable>
          {isExpanded?<View style={{gap:9}}>{o.tracking_code?<Text style={styles.accountRowSub}>Tracking ID: {o.tracking_code}</Text>:null}{o.delivery_partner?<Text style={styles.accountRowSub}>Courier: {o.delivery_partner}</Text>:null}<KanevOrderProgress status={o.status||o.delivery_status} fulfilment={o.fulfilment}/>{(orderTrackingEvents[o.id]||[]).filter(ev=>!/^order status changed\s/i.test(String(ev.message||'').trim())).length?<View style={{paddingLeft:11,borderLeftWidth:2,borderLeftColor:'#C8DCCF',gap:8}}>{(orderTrackingEvents[o.id]||[]).filter(ev=>!/^order status changed\s/i.test(String(ev.message||'').trim())).slice(0,5).map(ev=><View key={ev.id}><Text style={{fontSize:12,fontWeight:'800',color:COLORS.ink}}>{ev.message}</Text><Text style={{fontSize:10,color:COLORS.muted}}>{new Date(ev.created_at).toLocaleString()}{ev.location?' · '+ev.location:''}</Text></View>)}</View>:<Text style={styles.accountRowSub}>Progress updates will appear here as the pharmacy processes your order.</Text>}</View>:null}
        </View>;
      })}
    </View>;
  };
  const HealthDocumentsPage = () => {
    const activeDocType = !isDesktop && tab === 'LabResults' ? 'lab_result' : !isDesktop && tab === 'Prescriptions' ? 'prescription' : null;
    const normalizeHealthDocumentType = value => { const type = String(value || '').toLowerCase().replace(/[\s-]+/g, '_'); if (['prescription','prescriptions','rx'].includes(type)) return 'prescription'; if (['lab_result','lab_results','lab','lab_test','lab_tests','test_result','test_results','laboratory_result','laboratory_results'].includes(type)) return 'lab_result'; return type; };
    const visibleHealthDocuments = activeDocType ? healthDocuments.filter(doc => normalizeHealthDocumentType(doc.document_type) === activeDocType) : healthDocuments;
    if (!session?.user) return <View style={styles.formCard}><Text style={styles.accountHeading}>Sign in required</Text><Text style={styles.accountCopy}>Sign in to securely upload and track prescriptions or lab results.</Text><ActionButton title="Sign in" onPress={() => { setAuthMode('signin'); setAuthModalVisible(true); setTab('Account'); }} /></View>;
    return <View style={{width:'100%',gap:12}}>
      <Pressable onPress={() => setTab('Home')} style={{flexDirection:'row',alignItems:'center',gap:7,alignSelf:'flex-start',paddingVertical:5}}><Ionicons name="arrow-back" size={18} color={COLORS.green}/><Text style={{fontSize:13,fontWeight:'800',color:COLORS.green}}>Back to home</Text></Pressable>
      <View style={{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:16,padding: isDesktop ? 24 : 14}}>
              <View style={styles.myAccountSectionHeader}><View><Text style={styles.myAccountSectionTitle}>{activeDocType === 'lab_result' ? 'Lab Test Results' : activeDocType === 'prescription' ? 'Prescriptions' : 'Prescriptions & lab results'}</Text><Text style={styles.myAccountSectionSub}>{activeDocType === 'lab_result' ? 'Upload lab results and follow the pharmacy review.' : activeDocType === 'prescription' ? 'Upload prescriptions and follow the pharmacy review.' : 'Upload documents securely and follow the pharmacy\'s review.'}</Text></View></View>
              <View style={{padding:14,borderRadius:12,backgroundColor:'#F0F7F2',borderWidth:1,borderColor:COLORS.border,marginBottom:14}}>
                <Text style={styles.myAccountQuickTitle}>Prepare your submission</Text>
                <View style={{flexDirection:isDesktop?'row':'column',gap:14,marginTop:12,alignItems:'stretch'}}>
                  <View style={{flex:isDesktop?1:undefined,minHeight:280,borderRadius:12,borderWidth:1,borderColor:'#D5E4DA',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',padding:12,overflow:'hidden'}}>
                    {selectedHealthAsset ? (String(selectedHealthAsset.mimeType||'').startsWith('image/') ? <Image source={{uri:selectedHealthAsset.uri}} resizeMode="contain" style={{width:'100%',height:280}} /> : <View style={{alignItems:'center',gap:10,padding:20}}><Ionicons name="document-text" size={74} color={COLORS.green}/><Text style={{fontSize:14,fontWeight:'900',color:COLORS.ink,textAlign:'center'}}>PDF selected</Text><Text style={{fontSize:12,color:COLORS.muted,textAlign:'center',lineHeight:18}}>Your PDF is selected and ready to submit.</Text><Text style={{fontSize:11,color:COLORS.muted,textAlign:'center'}}>{selectedHealthAsset.name}</Text></View>) : <View style={{alignItems:'center',gap:10,padding:20}}><View style={{width:76,height:76,borderRadius:20,backgroundColor:'#E5F3EA',alignItems:'center',justifyContent:'center'}}><Ionicons name="image-outline" size={38} color={COLORS.green}/></View><Text style={{fontSize:14,fontWeight:'900',color:COLORS.ink}}>Document preview</Text><Text style={{fontSize:12,color:COLORS.muted,textAlign:'center',lineHeight:18}}>Choose a photo or PDF. It will appear here before you submit.</Text></View>}
                  </View>
                  <View style={{flex:isDesktop?1:undefined,gap:9,minWidth:0}}>
                    <Text style={styles.myAccountQuickTitle}>Document details</Text>
                    {!activeDocType && <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[['prescription','Prescription','document-text-outline'],['lab_result','Lab result','flask-outline']].map(([value,label,icon])=><Pressable key={value} onPress={()=>setHealthDocType(value)} style={{padding:10,borderRadius:9,borderWidth:1,borderColor:healthDocType===value?COLORS.green:COLORS.border,backgroundColor:healthDocType===value?'#E0F2E8':'#fff',flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name={icon} size={17} color={COLORS.green}/><Text style={{fontSize:12,fontWeight:'800',color:COLORS.green}}>{label}</Text></Pressable>)}</View>}
                    <TextInput value={healthDocTitle} onChangeText={setHealthDocTitle} placeholder="Title (optional)" placeholderTextColor={COLORS.muted} style={styles.fieldInput} />
                    <TextInput value={healthDocNotes} onChangeText={setHealthDocNotes} placeholder="Note for the pharmacy (optional)" placeholderTextColor={COLORS.muted} multiline style={[styles.fieldInput,{minHeight:90,textAlignVertical:'top'}]} />
                    <Text style={{fontSize:11,color:COLORS.muted,lineHeight:16}}>PDF, JPG, PNG or WebP · Maximum 10 MB. Only you and authorized pharmacy staff can access the uploaded file.</Text>
                    {selectedHealthAsset ? <View style={{padding:10,borderRadius:9,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name={String(selectedHealthAsset.mimeType||'').startsWith('application/pdf')?'document-text-outline':'image-outline'} size={20} color={COLORS.green}/><Text numberOfLines={2} style={{fontSize:12,color:COLORS.ink,flex:1}}>{selectedHealthAsset.name}</Text><Pressable onPress={()=>setSelectedHealthAsset(null)} accessibilityLabel="Remove selected file"><Ionicons name="close-circle" size={20} color={COLORS.muted}/></Pressable></View> : null}
                    <ActionButton title={selectedHealthAsset ? 'Change selected file' : 'Choose file to preview'} secondary onPress={chooseHealthDocumentFile} disabled={healthDocUploading}/>
                    <ActionButton title={healthDocUploading?'Submitting securely…':'Submit document'} onPress={uploadHealthDocument} disabled={healthDocUploading||!selectedHealthAsset}/>
                    <Text style={{fontSize:10,color:COLORS.muted}}>Nothing is uploaded until you press Submit document.</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.myAccountSectionHeader,!isDesktop&&{alignItems:'flex-start',flexDirection:'column',gap:3}]}><View><Text style={styles.myAccountSectionTitle}>My submissions</Text><Text style={styles.myAccountSectionSub}>Feedback and status updates from Kanev Pharmacy</Text></View>{isDesktop&&<Text style={styles.myAccountSectionSub}>Updates automatically</Text>}</View>
              {visibleHealthDocuments.length===0?<View style={styles.myAccountEmpty}><View style={styles.myAccountEmptyIcon}><Ionicons name="document-text-outline" size={27} color={COLORS.green}/></View><Text style={styles.myAccountEmptyTitle}>No documents submitted</Text><Text style={styles.myAccountEmptyCopy}>{activeDocType === 'lab_result' ? 'Your submitted lab results will appear here with review updates.' : activeDocType === 'prescription' ? 'Your submitted prescriptions will appear here with review updates.' : 'Your uploaded prescriptions and lab results will appear here with review updates.'}</Text></View>:visibleHealthDocuments.map(doc=>{
                const messages=healthDocMessages[doc.id]||[], closed=!!doc.conversation_closed_at;
                const expanded = expandedHealthDocumentId === doc.id;
                return <View key={doc.id} style={[styles.myAccountOrderRow,{flexDirection:'column',alignItems:'stretch',width:'100%',minWidth:0,marginBottom:10,paddingVertical:0},!isDesktop&&{borderWidth:1,borderColor:COLORS.border,borderRadius:13,backgroundColor:'#FFFFFF',paddingHorizontal:12,overflow:'hidden'}]}>
                  <Pressable onPress={()=>toggleHealthDocument(doc,expanded)} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,flexWrap:'wrap'}}>
                    <View style={[styles.myAccountOrderIcon,{width:36,height:36}]}><Ionicons name={doc.document_type==='prescription'?'document-text-outline':'flask-outline'} size={19} color={COLORS.green}/></View>
                    <View style={{flex:1,minWidth:0,gap:3}}>
                      <Text style={styles.accountRowTitle}>{healthDocumentNumber(doc)}</Text>
                      <Text style={styles.accountRowSub}>{new Date(doc.created_at).toLocaleString()}</Text>
                    </View>
                    <View style={{alignItems:'flex-end',gap:5}}>
                      <View style={{paddingHorizontal:8,paddingVertical:5,borderRadius:7,backgroundColor:doc.status==='completed'?'#E0F2E8':'#EEF1EF'}}><Text style={{fontSize:10,fontWeight:'900',color:COLORS.green}}>{String(doc.status||'submitted').replaceAll('_',' ')}</Text></View>
                      {(healthDocMessages[doc.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[doc.id]||[]).slice(-1)[0]?.read_at?<View style={{paddingHorizontal:9,paddingVertical:5,borderRadius:8,backgroundColor:'#DBEAFE',borderWidth:1,borderColor:'#93C5FD'}}><Text style={{fontSize:9,fontWeight:'900',color:'#1D4ED8'}}>NEW REPLY</Text></View>:null}
                    </View>
                    <Ionicons name={expanded?'chevron-up':'chevron-down'} size={17} color={COLORS.muted}/>
                  </Pressable>
                  {expanded ? <View style={{paddingBottom:12,gap:7}}>
                    <View style={{padding:11,borderRadius:10,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,gap:6}}><Text style={{fontSize:13,fontWeight:'900',color:COLORS.ink}}>{doc.title || (normalizeHealthDocumentType(doc.document_type)==='prescription'?'Prescription':'Lab result')}</Text><Text style={styles.accountRowSub}>Type: {normalizeHealthDocumentType(doc.document_type)==='prescription'?'Prescription':'Lab result'}</Text><Text style={styles.accountRowSub}>Submitted: {doc.created_at ? new Date(doc.created_at).toLocaleString() : 'Date unavailable'}</Text><Text style={styles.accountRowSub}>File: {doc.file_name||'Uploaded document'}</Text>{doc.preview_url ? (()=>{const mime=String(doc.mime_type||'').toLowerCase();const name=String(doc.file_name||'').toLowerCase();const isImage=mime.startsWith('image/')||/\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name);const isPdf=mime.includes('pdf')||name.endsWith('.pdf');return <View style={{marginTop:7,padding:10,borderRadius:10,backgroundColor:'#F7FAF8',borderWidth:1,borderColor:COLORS.border,gap:8}}>{isImage?<Image source={{uri:doc.preview_url}} resizeMode="contain" style={{width:'100%',height:220,backgroundColor:'#F4F8F5',borderRadius:8}}/>:<View style={{flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name={isPdf?'document-text-outline':'document-outline'} size={23} color={COLORS.green}/><View style={{flex:1}}><Text style={{fontSize:12,fontWeight:'900',color:COLORS.ink}}>{isPdf?'PDF document':'Uploaded document'}</Text><Text style={styles.accountRowSub}>Your original submitted file is available.</Text></View></View>}<Pressable onPress={()=>setSelectedHealthDocumentViewer(doc)} style={{padding:11,borderRadius:9,backgroundColor:'#EAF5EE',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}><Ionicons name="eye-outline" size={17} color={COLORS.green}/><Text style={{fontSize:12,fontWeight:'900',color:COLORS.green}}>View uploaded {isPdf?'PDF':'file'}</Text></Pressable></View>})():<Text style={{fontSize:11,color:'#9A6B18',marginTop:5}}>The file could not be opened. Please contact the pharmacy.</Text>}{doc.notes ? <Text style={{fontSize:12,color:COLORS.ink,lineHeight:18}}>Your note: {doc.notes}</Text> : null}{doc.admin_feedback ? <View style={{marginTop:4,padding:10,borderRadius:8,backgroundColor:'#EAF5EE'}}><Text style={{fontSize:10,fontWeight:'900',color:COLORS.green,marginBottom:4}}>PHARMACY FEEDBACK</Text><Text style={{fontSize:12,color:COLORS.ink,lineHeight:18}}>{doc.admin_feedback}</Text>{doc.reviewed_at ? <Text style={{fontSize:10,color:COLORS.muted,marginTop:4}}>Reviewed: {new Date(doc.reviewed_at).toLocaleString()}</Text> : null}</View> : <Text style={{fontSize:11,color:COLORS.muted}}>The pharmacy has not added feedback yet.</Text>}</View>
                    <View style={{marginTop:4,padding:12,borderRadius:12,backgroundColor:'#F7FAF8',borderWidth:1,borderColor:COLORS.border}}>
                      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8}}><View style={{flexDirection:'row',alignItems:'center',gap:7,flex:1}}><Ionicons name="chatbubbles-outline" size={18} color={COLORS.green}/><Text style={{fontSize:12,fontWeight:'900',color:COLORS.ink}}>Pharmacy conversation</Text></View><Text style={{fontSize:10,fontWeight:'900',color:closed?COLORS.muted:COLORS.green}}>{closed?'CLOSED':'OPEN'}</Text></View>
                      {messages.length===0?<Text style={styles.accountRowSub}>No messages yet. The pharmacy will reply here after reviewing your document.</Text>:<View style={{gap:9,marginBottom:10}}>{messages.map(m=>{const own=m.sender_role==='customer';return <View key={m.id} style={{alignSelf:own?'flex-end':'flex-start',maxWidth:'92%',padding:10,borderRadius:12,backgroundColor:own?'#DDF4E6':'#FFFFFF',borderWidth:1,borderColor:own?'#C2E4D0':'#DCE8E1'}}><Text style={{fontSize:10,fontWeight:'900',color:COLORS.green,marginBottom:4}}>{own?'YOU':'KANEV PHARMACY'}</Text><Text style={{fontSize:12,color:COLORS.ink,lineHeight:18}}>{m.message}</Text><Text style={{fontSize:10,color:COLORS.muted,marginTop:5}}>{new Date(m.created_at).toLocaleString()}</Text></View>;})}</View>}
                      {closed?<View style={{flexDirection:'row',gap:7,padding:10,borderRadius:9,backgroundColor:'#ECEFEC'}}><Ionicons name="lock-closed-outline" size={16} color={COLORS.muted}/><Text style={{flex:1,fontSize:11,color:COLORS.muted,lineHeight:16}}>The pharmacy has closed this conversation. You can no longer reply.</Text></View>:<><TextInput value={healthDocReplyDrafts[doc.id]||''} onChangeText={v=>setHealthDocReplyDrafts(prev=>({...prev,[doc.id]:v}))} placeholder="Reply to Kanev Pharmacy…" placeholderTextColor={COLORS.muted} multiline style={[styles.fieldInput,{minHeight:68,textAlignVertical:'top',marginTop:2,marginBottom:8,backgroundColor:'#FFFFFF'}]}/><ActionButton title={healthDocSendingId===doc.id?'Sending reply…':'Send reply'} onPress={()=>sendHealthDocumentReply(doc)} disabled={healthDocSendingId===doc.id||!(healthDocReplyDrafts[doc.id]||'').trim()}/></>}
                    </View>
                  </View> : null}
                </View>;
              })}
      </View>
    </View>;
  };

  const renderPage = () => {
    if (selectedProduct && tab === 'Shop') return (
      <View style={styles.detailWrap}>
        <Pressable onPress={() => setSelectedProduct(null)} style={styles.backButton}><Ionicons name="arrow-back" size={21} color={COLORS.green} /><Text style={styles.backText}>Back to shop</Text></Pressable>
        <View style={{flexDirection:isDesktop?'row':'column',gap:22,alignItems:'flex-start'}}>
          <View style={{flex:isDesktop?1.05:undefined,minWidth:0,width:isDesktop?undefined:'100%',flexDirection:isDesktop?'row':'column',gap:12}}>
            {isDesktop ? <View style={{flexDirection:'column',gap:8,flexWrap:'wrap',justifyContent:'flex-start'}}>
              {(Array.isArray(selectedProduct.image_urls)&&selectedProduct.image_urls.length?selectedProduct.image_urls:(selectedProduct.image_url?[selectedProduct.image_url]:[])).map((url,index)=><Pressable key={url+index} onPress={()=>setSelectedProductImageIndex(index)} style={{width:68,height:68,borderRadius:9,borderWidth:selectedProductImageIndex===index?2:1,borderColor:selectedProductImageIndex===index?COLORS.blue:COLORS.border,backgroundColor:'#F7FAF8',padding:3,overflow:'hidden'}}><Image source={{uri:optimizedImageUrl(url,180,78)}} resizeMode="contain" style={{width:'100%',height:'100%'}}/></Pressable>)}
            </View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{flexDirection:'row',gap:8,paddingBottom:2}}>
              {(Array.isArray(selectedProduct.image_urls)&&selectedProduct.image_urls.length?selectedProduct.image_urls:(selectedProduct.image_url?[selectedProduct.image_url]:[])).map((url,index)=><Pressable key={url+index} onPress={()=>setSelectedProductImageIndex(index)} style={{width:62,height:62,borderRadius:10,borderWidth:selectedProductImageIndex===index?2:1,borderColor:selectedProductImageIndex===index?COLORS.blue:COLORS.border,backgroundColor:'#F7FAF8',padding:3,overflow:'hidden'}}><Image source={{uri:optimizedImageUrl(url,180,78)}} resizeMode="contain" style={{width:'100%',height:'100%'}}/></Pressable>)}
            </ScrollView>}
            <View
              onMouseEnter={()=>isDesktop&&setProductImageHoverZoom(true)}
              onMouseLeave={()=>setProductImageHoverZoom(false)}
              style={{flex:1,minWidth:0,height:isDesktop?390:270,borderWidth:1,borderColor:COLORS.border,borderRadius:14,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',padding:12,overflow:'hidden'}}
            >
              {(Array.isArray(selectedProduct.image_urls)&&selectedProduct.image_urls.length?selectedProduct.image_urls:(selectedProduct.image_url?[selectedProduct.image_url]:[])).length ? <Image onContextMenu={event=>event.preventDefault()} onDragStart={event=>event.preventDefault()} source={{uri:optimizedImageUrl((Array.isArray(selectedProduct.image_urls)&&selectedProduct.image_urls.length?selectedProduct.image_urls:(selectedProduct.image_url?[selectedProduct.image_url]:[]))[Math.min(selectedProductImageIndex,(Array.isArray(selectedProduct.image_urls)&&selectedProduct.image_urls.length?selectedProduct.image_urls:(selectedProduct.image_url?[selectedProduct.image_url]:[])).length-1)],1600,90)}} resizeMode="contain" style={{width:'100%',height:'100%',transform:[{scale:productImageHoverZoom&&isDesktop?2.05:1}],...(Platform.OS==='web'?{userSelect:'none',WebkitUserSelect:'none',WebkitUserDrag:'none'}:{})}}/> : <Ionicons name={selectedProduct.icon||'medical-outline'} size={76} color={COLORS.green}/>}
            </View>
          </View>
          <View style={{flex:isDesktop?1.35:undefined,minWidth:0,width:isDesktop?undefined:'100%',gap:12,paddingTop:2}}>
            <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
            {selectedProduct.brand?<Text style={{fontSize:13,color:'#263238',fontWeight:'800'}}>By {String(selectedProduct.brand).toUpperCase()}</Text>:null}
            <View style={{flexDirection:'row',alignItems:'center',gap:9,flexWrap:'wrap'}}><Text style={{backgroundColor:'#12A5DC',color:'#FFFFFF',fontWeight:'900',paddingHorizontal:9,paddingVertical:4,borderRadius:6}}>{Number(selectedProduct.rating||0).toFixed(0)} ★</Text><Text style={{fontSize:13,color:'#E65B5B'}}>Ratings & Reviews</Text></View>
            {selectedProduct.pack_size?<Text style={{fontSize:13,fontWeight:'800',color:COLORS.ink}}>{selectedProduct.pack_size}</Text>:null}
            <View style={{flexDirection:'row',alignItems:'center',gap:22,marginTop:8,flexWrap:'wrap'}}>
              <View style={{alignItems:'center',gap:4}}><Ionicons name="shield-checkmark-outline" size={18} color={COLORS.blue}/><Text style={{fontSize:11,color:COLORS.muted}}>Trusted by Millions</Text></View>
              <View style={{alignItems:'center',gap:4}}><Ionicons name="ribbon-outline" size={18} color={COLORS.blue}/><Text style={{fontSize:11,color:COLORS.muted}}>100% Original Products</Text></View>
            </View>
            <View style={{gap:7,marginTop:8}}>
              {selectedProduct.summary?<Text style={styles.detailDescription}>{selectedProduct.summary}</Text>:null}
            </View>
          </View>
          <View style={{flex:isDesktop?0.9:undefined,width:isDesktop?undefined:'100%',minWidth:0,borderWidth:1,borderColor:COLORS.border,borderRadius:9,padding:16,gap:12,backgroundColor:'#FFFFFF'}}>
            <View style={{alignSelf:'flex-start',backgroundColor:selectedProduct.stock>0?'#DDF8E8':'#FFF0E5',borderRadius:20,paddingHorizontal:10,paddingVertical:5}}><Text style={{fontSize:11,fontWeight:'800',color:selectedProduct.stock>0?'#16834B':'#C45B19'}}>Stock : {selectedProduct.stock>0?'In Stock':'Out of Stock'}</Text></View>
            <View style={{flexDirection:'row',alignItems:'baseline',gap:8,flexWrap:'wrap'}}><Text style={{fontSize:23,fontWeight:'900',color:'#171717'}}>{money(selectedProduct.price)}</Text>{selectedProduct.original_price>selectedProduct.price?<Text style={{fontSize:15,color:'#9AA3AA',textDecorationLine:'line-through'}}>{money(selectedProduct.original_price)}</Text>:null}</View>
            {selectedProduct.discount_percent>0?<Text style={{alignSelf:'flex-start',backgroundColor:'#FF7417',color:'#FFFFFF',fontSize:11,fontWeight:'900',paddingHorizontal:9,paddingVertical:5,borderRadius:5}}>{selectedProduct.discount_percent}% Off</Text>:null}
            <Text style={{fontSize:13,color:COLORS.muted}}>Inclusive of all taxes</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:0}}>
              <Pressable onPress={()=>setSelectedProductQuantity(q=>Math.max(1,q-1))} style={{width:38,height:40,borderWidth:1,borderColor:COLORS.border,borderTopLeftRadius:6,borderBottomLeftRadius:6,alignItems:'center',justifyContent:'center'}}><Ionicons name="remove" size={17} color={COLORS.ink}/></Pressable>
              <View style={{width:48,height:40,borderTopWidth:1,borderBottomWidth:1,borderColor:COLORS.border,alignItems:'center',justifyContent:'center'}}><Text style={{fontWeight:'800',color:COLORS.ink}}>{selectedProductQuantity}</Text></View>
              <Pressable onPress={()=>setSelectedProductQuantity(q=>Math.min(selectedProduct.stock>0?selectedProduct.stock:99,q+1))} style={{width:38,height:40,borderWidth:1,borderColor:COLORS.border,borderTopRightRadius:6,borderBottomRightRadius:6,alignItems:'center',justifyContent:'center'}}><Ionicons name="add" size={17} color={COLORS.ink}/></Pressable>
              <View style={{flex:1}}/>
              <Pressable disabled={selectedProduct.stock<1} onPress={()=>addToCart(selectedProduct,selectedProductQuantity)} style={{height:40,paddingHorizontal:15,borderRadius:6,backgroundColor:COLORS.blue,alignItems:'center',justifyContent:'center',opacity:selectedProduct.stock<1?0.5:1}}><Text style={{color:'#FFFFFF',fontSize:13,fontWeight:'900'}}>Add to Cart</Text></Pressable>
            </View>
            <Pressable disabled={selectedProduct.stock<1} onPress={()=>{if(!requireCustomerLogin())return;addToCart(selectedProduct,selectedProductQuantity);setTab('Cart');}} style={{height:42,borderWidth:1.5,borderColor:COLORS.blue,borderRadius:6,alignItems:'center',justifyContent:'center',opacity:selectedProduct.stock<1?0.5:1}}><Text style={{color:COLORS.blue,fontWeight:'900',fontSize:13}}>Buy Now</Text></Pressable>
            <View style={{borderTopWidth:1,borderColor:COLORS.border,paddingTop:12,gap:5}}><Text style={{fontSize:13,fontWeight:'800',color:COLORS.ink}}>Category: <Text style={{color:COLORS.blue,fontWeight:'500'}}>{selectedProduct.category}</Text></Text><Text style={{fontSize:12,color:COLORS.muted}}>Availability and final dispensing decisions are subject to pharmacy confirmation.</Text></View>
          </View>
        </View>
        <View style={{marginTop:28,borderTopWidth:1,borderColor:COLORS.border,paddingTop:20}}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.detailDescription}>{selectedProduct.description||'No additional description has been provided for this product yet.'}</Text>
        </View>
        <View style={{marginTop:24,borderTopWidth:1,borderColor:COLORS.border,paddingTop:20}}>
          <Text style={styles.sectionTitle}>Related Products</Text>
          <View style={styles.productGrid}>{products.filter(p=>p.id!==selectedProduct.id&&((p.category_ids||[]).some(id=>(selectedProduct.category_ids||[]).includes(id))||p.category===selectedProduct.category)).slice(0,5).map(p=><ProductCard key={p.id} product={p} cardWidth={isDesktop?'19%':'48%'} imageResizeMode="contain" onAdd={addToCart} onOpen={()=>{setSelectedProduct(p);setSelectedProductImageIndex(0);}}/>)}</View>
        </View>
      </View>
    );
    switch (tab) {
      case 'Shop': return Shop();
      case 'Cart': return Cart();
      case 'Checkout': return Checkout();
      case 'Orders': return CustomerOrdersPage();
      case 'HealthDocuments': return HealthDocumentsPage();
      case 'Prescriptions': return HealthDocumentsPage();
      case 'LabResults': return HealthDocumentsPage();
      case 'Account': return Account({ compact: true });
      default: return Home();
    }
  };

  // Keep the storefront hidden until the saved session has been classified.
  if (!authInitialized) {
    return (
      <AppSafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ExpoStatusBar style="dark" />
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        {(loginBranding.loading_logo_url || loginBranding.header_logo_url || cachedStartupLogoUrl) ? <Image loading="eager" source={{ uri: loginBranding.loading_logo_url || loginBranding.header_logo_url || cachedStartupLogoUrl }} resizeMode="contain" style={{ width: 132, height: 132 }} /> : null}
        <Text style={styles.brandName}>{loginBranding.pharmacy_title || 'Kanev Pharmacy'}</Text>
      </AppSafeAreaView>
    );
  }

  // Management is rendered only for an authenticated, role-checked admin session.
  if (tab === 'Management') {
    return <KanevAdminPortal onExit={() => { setNotice(current => ({ ...current, visible: false })); setTab('Home'); setSelectedProduct(null); }} />;
  }

  return (
    <AppSafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      {Header()}
      {isDesktop && <View ref={menuNavRef} style={styles.tmNavSticky} onHoverIn={() => { if (menuCloseTimer.current) clearTimeout(menuCloseTimer.current); }} onHoverOut={() => { if (isDesktop && !desktopMenuPinned) scheduleDesktopMenuClose(); }}>
        {storeMenuItems.length ? <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tmNav} keyboardShouldPersistTaps="handled">
            {storeMenuItems.filter(item => !item.parent_id).map(item => {
              const children = storeMenuItems.filter(child => child.parent_id === item.id);
              const rootExpanded = isDesktop ? desktopMenuRootId === item.id : (Array.isArray(expandedMenuId) && expandedMenuId.includes(item.id));
              return <Pressable key={item.id} ref={node => { if (node) menuItemRefs.current[item.id] = node; else delete menuItemRefs.current[item.id]; }} onLayout={event => { const layout = event?.nativeEvent?.layout; if (layout) measureDesktopMenuAnchor(item.id, layout); }} onHoverIn={() => { if (session?.user && isDesktop && children.length && !desktopMenuPinned) openDesktopMenu(item.id, children[0]?.id, desktopMenuAnchors[item.id]); }} onHoverOut={() => { if (isDesktop && children.length && !desktopMenuPinned) scheduleDesktopMenuClose(); }} onPress={() => { if (!requireCustomerLogin()) return; children.length ? (isDesktop ? (rootExpanded && desktopMenuPinned ? (setDesktopMenuPinned(false), setDesktopMenuRootId(null), setDesktopMenuCategoryId(null)) : (openDesktopMenu(item.id, children[0]?.id, desktopMenuAnchors[item.id]), setDesktopMenuPinned(true))) : setExpandedMenuId(prev => { const current = Array.isArray(prev) ? prev : []; return current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]; })) : selectStoreMenuItem(item); }} style={[styles.tmNavLink, rootExpanded && { backgroundColor: '#EAF5EE' }]} accessibilityRole="button" accessibilityLabel={`Browse ${item.label}`}>
                <Text style={styles.tmNavText}>{item.label}</Text>{children.length ? <Ionicons name={rootExpanded?'chevron-up':'chevron-down'} size={13} color={COLORS.green}/> : null}
              </Pressable>;
            })}
          </ScrollView>
          {isDesktop && desktopMenuRootId && (() => {
            const root = storeMenuItems.find(item => item.id === desktopMenuRootId && item.is_active !== false);
            if (!root) return null;
            const categories = storeMenuItems.filter(item => item.parent_id === root.id && item.is_active !== false);
            const activeCategory = categories.find(item => item.id === desktopMenuCategoryId) || categories[0] || null;
            const subcategories = activeCategory ? storeMenuItems.filter(item => item.parent_id === activeCategory.id && item.is_active !== false) : [];
            const panelWidth = Math.min(610, Math.max(280, viewportWidth - 16));
            const desktopMenuAnchor = desktopMenuAnchors[desktopMenuRootId] || { x: 14, width: 120 };
            const rawLeft = desktopMenuAnchor.x || 14;
            const left = rawLeft + panelWidth > viewportWidth - 8
              ? Math.max(8, rawLeft + (desktopMenuAnchor.width || 120) - panelWidth)
              : Math.max(8, rawLeft);
            const leftColumnWidth = categories.length ? Math.min(220, Math.max(160, panelWidth * 0.36)) : panelWidth;
            return <View onHoverIn={() => { if (menuCloseTimer.current) clearTimeout(menuCloseTimer.current); }} style={{ position:'absolute', top:'100%', left, width:panelWidth, maxWidth:viewportWidth-16, backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#DCE8E0', borderTopWidth:2, borderTopColor:COLORS.green, borderBottomLeftRadius:12, borderBottomRightRadius:12, flexDirection:'row', zIndex:1000, elevation:14, shadowColor:'#0B3023', shadowOpacity:0.16, shadowRadius:14, shadowOffset:{width:0,height:8}, overflow:'hidden' }}>
              <View style={{ width:leftColumnWidth, maxHeight:390, backgroundColor:'#FFFFFF', paddingVertical:8, borderRightWidth:categories.length?1:0, borderColor:'#E7EEE9' }}>
                {categories.length ? <ScrollView nestedScrollEnabled>{categories.map(item => {
                  const hasChildren = storeMenuItems.some(child => child.parent_id === item.id && child.is_active !== false);
                  const selected = activeCategory?.id === item.id;
                  return <Pressable key={item.id} onHoverIn={() => setDesktopMenuCategoryId(item.id)} onPress={() => hasChildren ? setDesktopMenuCategoryId(item.id) : selectStoreMenuItem(item)} style={{ minHeight:40, paddingVertical:11, paddingHorizontal:14, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:selected?'#EEF7F1':'#FFFFFF' }}><Text numberOfLines={2} style={{ fontSize:13, color:selected?COLORS.green:'#52645B', fontWeight:selected?'800':'600', flex:1 }}>{item.label}</Text>{hasChildren ? <Ionicons name="chevron-forward" size={15} color={selected?COLORS.green:'#7C8A84'}/> : null}</Pressable>;
                })}</ScrollView> : <View style={{padding:18,gap:8}}><Text style={{fontSize:15,fontWeight:'800',color:COLORS.ink}}>{root.label}</Text><Text style={{fontSize:12,color:COLORS.muted}}>Browse this section</Text><Pressable onPress={() => selectStoreMenuItem(root)} style={{paddingVertical:9}}><Text style={{fontSize:13,fontWeight:'800',color:COLORS.green}}>View all {root.label} →</Text></Pressable></View>}
              </View>
              {categories.length ? <View style={{ flex:1, minWidth:0, maxHeight:390, padding:16, backgroundColor:'#F8FBF9' }}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:8 }}><Text numberOfLines={1} style={{fontSize:15,fontWeight:'900',color:COLORS.ink,flex:1}}>{activeCategory?.label || root.label}</Text>{activeCategory ? <Pressable onPress={() => selectStoreMenuItem(activeCategory)}><Text style={{fontSize:11,color:COLORS.green,fontWeight:'800'}}>View all →</Text></Pressable> : null}</View>
                <ScrollView nestedScrollEnabled>{subcategories.length ? <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{subcategories.map(sub => <Pressable key={sub.id} onPress={() => selectStoreMenuItem(sub)} style={{width: panelWidth < 430 ? '100%' : '47%', minHeight:38, justifyContent:'center', paddingVertical:8, paddingHorizontal:9, backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#E1EBE4', borderRadius:8}}><Text style={{fontSize:12,color:'#53645C'}}>{sub.label}</Text></Pressable>)}</View> : <Text style={{fontSize:12,color:COLORS.muted,lineHeight:19}}>Choose {activeCategory?.label || 'a category'} to view its products.</Text>}</ScrollView>
              </View> : null}
            </View>;
          })()}
          {!isDesktop && Array.isArray(expandedMenuId) && expandedMenuId.some(id => !storeMenuItems.find(item => item.id === id)?.parent_id) && <View style={{backgroundColor:'#FFFFFF',borderTopWidth:1,borderColor:'#E0EAE4',paddingHorizontal:12,paddingVertical:6,maxHeight:360}}><ScrollView nestedScrollEnabled>{expandedMenuId.filter(id => !storeMenuItems.find(item => item.id === id)?.parent_id).map(rootId => <View key={rootId} style={{marginBottom:8}}><StoreMenuBranch items={Object.assign(storeMenuItems.filter(item=>item.parent_id===rootId),{_allItems:storeMenuItems})} expandedId={expandedMenuId} setExpandedId={setExpandedMenuId} onSelect={selectStoreMenuItem}/></View>)}</ScrollView></View>}
        </> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tmNav} keyboardShouldPersistTaps="handled">
          {['Medicines', 'Personal Care', 'Wellness', 'Baby Care', 'Skincare', 'Medical Supplies'].map(label => <Pressable key={label} onPress={() => openStoreShop(label)} style={styles.tmNavLink}><Text style={styles.tmNavText}>{label}</Text></Pressable>)}
        </ScrollView>}
      </View>}
{!isDesktop && !['Shop','Account','Orders','Prescriptions','LabResults'].includes(tab) && <View style={styles.mobileHeaderSearchWrap}>
        <View style={styles.mobileHeaderSearch}>
          <Ionicons name="search-outline" size={19} color={COLORS.muted}/>
          <TextInput value={query} onFocus={() => { if (!session?.user) { requireCustomerLogin(); return; } setHeaderSearchFocused(true); }} onBlur={() => setTimeout(() => setHeaderSearchFocused(false), 350)} onChangeText={value => { if (session?.user) setQuery(value); }} onSubmitEditing={() => openStoreShop('All')} placeholder="" placeholderTextColor="#7C8A84" style={styles.mobileHeaderSearchInput} returnKeyType="search" />
          {!query.trim() && rotatingProducts.length > 0 && <View pointerEvents="none" style={styles.rotatingPlaceholderClipMobile}><Text style={[styles.rotatingPlaceholderText, { fontWeight: '700' }]}>Shop </Text><View style={styles.rotatingProductClip}><Animated.Text numberOfLines={1} style={[styles.rotatingPlaceholderText,{transform:[{translateY:placeholderSlide}]}]}>{rotatingProducts[placeholderIndex % rotatingProducts.length]}…</Animated.Text></View></View>}
          <Pressable style={[styles.mobileHeaderSearchButton,{width:40,height:38,paddingHorizontal:0,borderRadius:20}]} onPress={() => {openStoreShop('All');setHeaderSearchFocused(false);}} accessibilityLabel="Search products"><Ionicons name="search" size={19} color="#FFFFFF"/></Pressable>
        </View>
        {headerSearchFocused && query.trim().length > 0 && <View style={styles.mobileHeaderSearchDropdown}>
          {catalogueLoading ? <Text style={styles.headerSearchNoResult}>Searching the product catalogue…</Text> : headerSearchMatches.length ? headerSearchMatches.map(p => <Pressable key={p.id} style={styles.headerSearchResult} onPress={() => {openStoreProduct(p);setHeaderSearchFocused(false);}}><View style={styles.headerSearchResultIcon}>{p.image_url ? <Image source={{uri:p.image_url}} style={{width:34,height:34,borderRadius:8}} resizeMode="contain"/> : <Ionicons name="medical-outline" size={19} color={COLORS.green}/>}</View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.headerSearchResultName}>{p.name}</Text><Text numberOfLines={1} style={styles.headerSearchResultMeta}>{p.category || p.brand || 'Pharmacy product'}</Text></View><Text style={styles.headerSearchResultPrice}>{money(p.price)}</Text></Pressable>) : <Text style={styles.headerSearchNoResult}>No matching products found.</Text>}
          <Pressable style={styles.headerSearchAll} onPress={() => {openStoreShop('All');setHeaderSearchFocused(false);}}><Text style={styles.headerSearchAllText}>View all search results</Text><Ionicons name="arrow-forward" size={15} color={COLORS.blue}/></Pressable>
        </View>}
      </View>}
      <ScrollView ref={pageScrollRef} style={styles.scroll} contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesktop, isTablet && styles.pageContentTablet, !isDesktop && styles.pageContentMobile]} stickyHeaderIndices={!isDesktop && tab === 'Shop' ? [2] : []} keyboardShouldPersistTaps="handled">
      {!isDesktop && tab === 'Shop' && <View style={styles.mobileHeaderSearchWrap}>
        <View style={styles.mobileHeaderSearch}>
          <Ionicons name="search-outline" size={19} color={COLORS.muted}/>
          <TextInput value={query} onFocus={() => { if (!session?.user) { requireCustomerLogin(); return; } setHeaderSearchFocused(true); }} onBlur={() => setTimeout(() => setHeaderSearchFocused(false), 350)} onChangeText={value => { if (session?.user) setQuery(value); }} onSubmitEditing={() => openStoreShop('All')} placeholder="" placeholderTextColor="#7C8A84" style={styles.mobileHeaderSearchInput} returnKeyType="search" />
          {!query.trim() && rotatingProducts.length > 0 && <View pointerEvents="none" style={styles.rotatingPlaceholderClipMobile}><Text style={[styles.rotatingPlaceholderText, { fontWeight: '700' }]}>Shop </Text><View style={styles.rotatingProductClip}><Animated.Text numberOfLines={1} style={[styles.rotatingPlaceholderText,{transform:[{translateY:placeholderSlide}]}]}>{rotatingProducts[placeholderIndex % rotatingProducts.length]}…</Animated.Text></View></View>}
          <Pressable style={[styles.mobileHeaderSearchButton,{width:40,height:38,paddingHorizontal:0,borderRadius:20}]} onPress={() => {openStoreShop('All');setHeaderSearchFocused(false);}} accessibilityLabel="Search products"><Ionicons name="search" size={19} color="#FFFFFF"/></Pressable>
        </View>
        {headerSearchFocused && query.trim().length > 0 && <View style={styles.mobileHeaderSearchDropdown}>
          {catalogueLoading ? <Text style={styles.headerSearchNoResult}>Searching the product catalogue…</Text> : headerSearchMatches.length ? headerSearchMatches.map(p => <Pressable key={p.id} style={styles.headerSearchResult} onPress={() => {openStoreProduct(p);setHeaderSearchFocused(false);}}><View style={styles.headerSearchResultIcon}>{p.image_url ? <Image source={{uri:p.image_url}} style={{width:34,height:34,borderRadius:8}} resizeMode="contain"/> : <Ionicons name="medical-outline" size={19} color={COLORS.green}/>}</View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.headerSearchResultName}>{p.name}</Text><Text numberOfLines={1} style={styles.headerSearchResultMeta}>{p.category || p.brand || 'Pharmacy product'}</Text></View><Text style={styles.headerSearchResultPrice}>{money(p.price)}</Text></Pressable>) : <Text style={styles.headerSearchNoResult}>No matching products found.</Text>}
          <Pressable style={styles.headerSearchAll} onPress={() => {openStoreShop('All');setHeaderSearchFocused(false);}}><Text style={styles.headerSearchAllText}>View all search results</Text><Ionicons name="arrow-forward" size={15} color={COLORS.blue}/></Pressable>
        </View>}
      </View>}
      {!isDesktop && !['Account','Orders','Prescriptions','LabResults'].includes(tab) && <View style={[styles.tmNavSticky,{position:'relative',zIndex:60,elevation:8},!isDesktop&&{marginHorizontal:-14}]}>
        {storeMenuItems.length ? <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tmNav} keyboardShouldPersistTaps="handled">
            {storeMenuItems.filter(item => !item.parent_id).map(item => {
              const children = storeMenuItems.filter(child => child.parent_id === item.id);
              const expanded = Array.isArray(expandedMenuId) && expandedMenuId.includes(item.id);
              return <Pressable key={item.id} onPress={() => {if(!requireCustomerLogin())return; children.length ? setExpandedMenuId(prev => {
                const current = Array.isArray(prev) ? prev : [];
                return current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id];
              }) : selectStoreMenuItem(item); }} style={[styles.tmNavLink, expanded && {backgroundColor:'#EAF5EE'}]} accessibilityRole="button">
                <Text style={styles.tmNavText}>{item.label}</Text>
                {children.length ? <Ionicons name={expanded?'chevron-up':'chevron-down'} size={13} color={COLORS.green}/> : null}
              </Pressable>;
            })}
          </ScrollView>
          {Array.isArray(expandedMenuId) && expandedMenuId.some(id => !storeMenuItems.find(item => item.id === id)?.parent_id) && <>
            <Pressable onPress={() => setExpandedMenuId([])} accessibilityRole="button" accessibilityLabel="Close category menu" style={{position:'absolute',top:0,left:-1000,right:-1000,height:viewportHeight,backgroundColor:'rgba(7,28,20,0.16)',zIndex:90,elevation:16}} />
            <View style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,elevation:18,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DCE8E0',borderTopWidth:2,borderTopColor:COLORS.green,borderBottomLeftRadius:16,borderBottomRightRadius:16,paddingHorizontal:12,paddingVertical:10,maxHeight:Math.round(viewportHeight*0.5),shadowColor:'#0B3023',shadowOpacity:0.18,shadowRadius:16,shadowOffset:{width:0,height:8},overflow:'hidden'}}>
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {expandedMenuId.filter(id => !storeMenuItems.find(item => item.id === id)?.parent_id).map(rootId =>
                  <View key={rootId} style={{marginBottom:8}}>
                    <StoreMenuBranch items={Object.assign(storeMenuItems.filter(item=>item.parent_id===rootId),{_allItems:storeMenuItems})} expandedId={expandedMenuId} setExpandedId={setExpandedMenuId} onSelect={item=>{selectStoreMenuItem(item);setExpandedMenuId([]);}}/>
                  </View>
                )}
              </ScrollView>
            </View>
          </>}
        </> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tmNav} keyboardShouldPersistTaps="handled">
          {['Medicines', 'Personal Care', 'Wellness', 'Baby Care', 'Skincare', 'Medical Supplies'].map(label => <Pressable key={label} onPress={() => openStoreShop(label)} style={styles.tmNavLink}><Text style={styles.tmNavText}>{label}</Text></Pressable>)}
        </ScrollView>}
      </View>}

      {!isDesktop && tab === 'Shop' && !selectedProduct && <View style={{backgroundColor:'#F4F8F5',paddingTop:2,paddingBottom:8,zIndex:20,elevation:3,borderBottomWidth:1,borderBottomColor:'#E1EAE4'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:2,paddingVertical:5}}>
          {['All', ...shopCategoryNodes.map(item => item.label)].map(c => (
            <Pressable key={c} onPress={() => openStoreShop(c)} style={[styles.filterChip,category===c&&styles.filterChipActive]}>
              <Text style={[styles.filterChipText,category===c&&styles.filterChipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>}
        {renderPage()}
        <View style={[styles.fullFooter, !isDesktop && { marginHorizontal: -14, paddingHorizontal: 16 }]} >
          <View style={styles.footerTop}>
            <View style={styles.footerAbout}><View style={styles.footerLogoRow}>{loginBranding.header_logo_url ? <Image loading="eager" source={{ uri: loginBranding.header_logo_url }} style={styles.footerLogo} resizeMode="contain" /> : null}<View><Text style={styles.footerBrand}>{loginBranding.pharmacy_title || 'Kanev Pharmacy'}</Text><Text style={styles.footerTagline}>{loginBranding.tagline || 'Closer to Your Health'}</Text></View></View><Text style={styles.footerAboutCopy}>Your trusted destination for medicines, personal care, baby care and everyday wellness in Zambia.</Text><Text style={styles.footerSmall}>Product availability and dispensing are subject to pharmacy confirmation.</Text></View>
            <View style={styles.footerColumn}><Text style={styles.footerColumnTitle}>Shop</Text>{['Medicines','Personal Care','Skincare','Baby Care','Wellness','Medical Supplies'].map(label=><Pressable key={label} onPress={()=>openStoreShop(label)}><Text style={styles.footerLink}>{label}</Text></Pressable>)}</View>
            <View style={styles.footerColumn}><Text style={styles.footerColumnTitle}>Customer service</Text>{[['My account','Account'],['My cart','Cart'],['Browse products','Shop'],['Get help','Account']].map(([label,target])=><Pressable key={label} onPress={()=>{if(target==='Shop')openStoreShop('All');else if(target==='Account'&&!session?.user)requireCustomerLogin();else if(target==='Cart')openCustomerCart();else setTab(target);}}><Text style={styles.footerLink}>{label}</Text></Pressable>)}</View>
            <View style={styles.footerColumn}><Text style={styles.footerColumnTitle}>Pharmacy information</Text><Text style={styles.footerLink}>{loginBranding.tagline || 'Closer to Your Health'}</Text><Text style={styles.footerLink}>Zambia · Prices in ZMW</Text><Text style={styles.footerLink}>Delivery or collection</Text><Text style={styles.footerLink}>Prescription review available</Text></View>
          </View>
          <View style={styles.footerBottom}><Text style={styles.footerBottomText}>© {new Date().getFullYear()} Kanev Pharmacy. All rights reserved.</Text><Text style={styles.footerBottomText}>Please use medicines responsibly and follow professional advice.</Text></View>
        </View>

      </ScrollView>
      <View pointerEvents="box-none" style={[styles.tabBar, isDesktop && styles.tabBarDesktop]}>
        {[
          {name:'Home',icon:'home-outline',active:tab==='Home'&&!selectedProduct,run:()=>{setSelectedProduct(null);setTab('Home');setMobileServicesOpen(false);}},
          {name:'Shop',icon:'grid-outline',active:tab==='Shop'&&!selectedProduct,run:()=>{openStoreShop('All');setMobileServicesOpen(false);}},
          {name:'Services',icon:'heart-outline',active:mobileServicesOpen,badge:healthDocuments.filter(d=>(healthDocMessages[d.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[d.id]||[]).slice(-1)[0]?.read_at).length,run:()=>{if(!requireCustomerLogin())return;setMobileServicesOpen(v=>!v);}},
          {name:'Account',icon:'person-outline',active:(tab==='Account'||tab==='Orders')&&!mobileServicesOpen,run:()=>{setSelectedProduct(null);setMobileServicesOpen(false);if(!session?.user){setAuthMode('signin');setAuthModalVisible(true);}else setTab('Account');}},
        ].map(item=>(
          <Pressable key={item.name} onPress={item.run} style={styles.tabItem} accessibilityRole="button" accessibilityLabel={item.name}>
            <View style={{position:'relative'}}><View style={[styles.tabIconWrap,item.active&&styles.tabIconWrapActive]}><Ionicons name={item.icon} size={21} color={item.active?COLORS.green:COLORS.muted}/></View>{item.badge>0?<View style={{position:'absolute',right:-9,top:-7,minWidth:19,height:19,paddingHorizontal:5,borderRadius:10,backgroundColor:'#2563EB',borderWidth:2,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:9,fontWeight:'900',color:'#FFFFFF'}}>{item.badge>99?'99+':item.badge}</Text></View>:null}</View>
            <Text style={[styles.tabLabel,item.active&&styles.tabLabelActive]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
      {!isDesktop && mobileServicesOpen && <Pressable onPress={()=>setMobileServicesOpen(false)} style={{position:'absolute',top:0,left:0,right:0,bottom:68,zIndex:80,backgroundColor:'rgba(8,28,20,0.22)'}} accessibilityLabel="Close services menu">
        <View style={{position:'absolute',left:12,right:12,bottom:10,backgroundColor:'#FFFFFF',borderRadius:20,padding:15,borderWidth:1,borderColor:COLORS.border,elevation:18,shadowColor:'#102B20',shadowOpacity:.16,shadowRadius:16,shadowOffset:{width:0,height:5}}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:10}}>
            <View style={{flex:1}}><Text style={{fontSize:16,fontWeight:'900',color:COLORS.ink}}>Healthcare services</Text><Text style={{fontSize:11,color:COLORS.muted,marginTop:3}}>Choose a service to continue</Text>{healthDocuments.some(d=>(healthDocMessages[d.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[d.id]||[]).slice(-1)[0]?.read_at)?<Text style={{fontSize:10,fontWeight:'800',color:'#1D4ED8',marginTop:5}}>You have new pharmacy replies</Text>:null}</View>
            <Pressable onPress={()=>setMobileServicesOpen(false)} style={{width:32,height:32,borderRadius:16,backgroundColor:'#F1F7F3',alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={19} color={COLORS.green}/></Pressable>
          </View>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>
            {[
              {title:'Upload prescription',sub:'Send for pharmacy review',icon:'document-text-outline',badge:healthDocuments.filter(d=>d.document_type==='prescription'&&(healthDocMessages[d.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[d.id]||[]).slice(-1)[0]?.read_at).length,run:()=>{setHealthDocType('prescription');if(session?.user)setTab(isDesktop?'HealthDocuments':'Prescriptions');else{setTab('Account');setAuthMode('signin');setAuthModalVisible(true);}}},
              {title:'Lab test results',sub:'Upload and view lab documents',icon:'flask-outline',badge:healthDocuments.filter(d=>d.document_type==='lab_result'&&(healthDocMessages[d.id]||[]).slice(-1)[0]?.sender_role==='admin'&&!(healthDocMessages[d.id]||[]).slice(-1)[0]?.read_at).length,run:()=>{setHealthDocType('lab_result');if(session?.user)setTab(isDesktop?'HealthDocuments':'LabResults');else{setTab('Account');setAuthMode('signin');setAuthModalVisible(true);}}},
              {title:'Delivery',sub:'Delivery information and tracking',icon:'car-outline',run:()=>{if(session?.user){if(!isDesktop){setTab('Orders');}else{setAccountSection('orders');setTab('Account');}}else{setTab('Account');setAuthMode('signin');setAuthModalVisible(true);}}},
              {title:'Health insurance',sub:'Insurance and co-pay support',icon:'shield-checkmark-outline',run:()=>notify('Health insurance','Contact Kanev Pharmacy to confirm accepted insurance providers and co-pay arrangements.')},
            ].map(item=><Pressable key={item.title} onPress={()=>{setMobileServicesOpen(false);setSelectedProduct(null);item.run();}} style={{width:'48%',flexGrow:1,minHeight:92,borderRadius:13,borderWidth:1,borderColor:'#E1EBE5',backgroundColor:'#FBFDFC',padding:11,gap:6}}>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{width:34,height:34,borderRadius:11,backgroundColor:'#E8F5ED',alignItems:'center',justifyContent:'center'}}><Ionicons name={item.icon} size={19} color={COLORS.green}/></View>{item.badge>0?<View style={{paddingHorizontal:8,minHeight:23,borderRadius:12,backgroundColor:'#DBEAFE',borderWidth:1,borderColor:'#93C5FD',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:10,fontWeight:'900',color:'#1D4ED8'}}>NEW REPLY · {item.badge>99?'99+':item.badge}</Text></View>:null}</View>
              <Text style={{fontSize:12,fontWeight:'900',color:COLORS.ink}}>{item.title}</Text><Text style={{fontSize:10,color:COLORS.muted,lineHeight:14}}>{item.sub}</Text>
            </Pressable>)}
          </View>
        </View>
      </Pressable>}
      <Modal visible={deliveryModalVisible} transparent animationType="fade" onRequestClose={() => setDeliveryModalVisible(false)} statusBarTranslucent>
        <View style={styles.deliveryModalOverlay}>
          <Pressable style={styles.authModalBackdrop} onPress={() => setDeliveryModalVisible(false)} accessibilityLabel="Close delivery location dialog" />
          <View style={styles.deliveryModalCard}>
            <View style={styles.deliveryModalHeader}><View style={styles.deliveryModalIcon}><Ionicons name="location" size={23} color={COLORS.green}/></View><View style={{flex:1}}><Text style={styles.deliveryModalTitle}>Choose delivery location</Text><Text style={styles.deliveryModalSub}>Find your address on Google Maps or use your current location.</Text></View><Pressable onPress={() => setDeliveryModalVisible(false)}><Ionicons name="close" size={23} color={COLORS.ink}/></Pressable></View>
            <Text style={styles.fieldLabel}>Area, street, landmark or address</Text>
            <TextInput value={deliverySearch} onChangeText={setDeliverySearch} placeholder="e.g. Kabulonga, Lusaka" placeholderTextColor={COLORS.muted} style={styles.fieldInput}/>
            <Pressable style={styles.deliveryMapButton} onPress={searchDeliveryOnGoogleMaps}><Ionicons name="map-outline" size={19} color={COLORS.blue}/><Text style={styles.deliveryMapButtonText}>Find on Google Maps</Text><Ionicons name="open-outline" size={16} color={COLORS.blue}/></Pressable>
            <Pressable style={styles.deliveryCurrentButton} onPress={useCurrentDeliveryLocation} disabled={locationBusy}><Ionicons name="navigate-outline" size={19} color={COLORS.green}/><Text style={styles.deliveryCurrentText}>{locationBusy ? 'Getting your location…' : 'Use my current location'}</Text></Pressable>
            <Text style={styles.deliveryModalHint}>Google Maps opens separately. Enter or adjust the chosen address here, then save it for checkout.</Text>
            <View style={styles.deliveryModalActions}><Pressable style={styles.deliveryCancelButton} onPress={() => setDeliveryModalVisible(false)}><Text style={styles.deliveryCancelText}>Cancel</Text></Pressable><Pressable style={styles.deliverySaveButton} onPress={saveDeliveryLocation}><Text style={styles.deliverySaveText}>Save location</Text></Pressable></View>
          </View>
        </View>
      </Modal>
      <Modal visible={authModalVisible && !session?.user} transparent animationType="fade" onRequestClose={() => setAuthModalVisible(false)} statusBarTranslucent>
        <View style={styles.authModalOverlay}>
          <Pressable style={styles.authModalBackdrop} onPress={() => setAuthModalVisible(false)} accessibilityLabel="Close sign in dialog" />
          <View style={[styles.authModalCard, isDesktop && styles.authModalCardDesktop]}>
            <Pressable style={styles.authModalClose} onPress={() => setAuthModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close login popup"><Ionicons name="close" size={23} color={COLORS.ink} /></Pressable>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.authModalScroll}>
              {Account({ compact: true })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!selectedHealthDocumentViewer} transparent={false} animationType="slide" onRequestClose={()=>setSelectedHealthDocumentViewer(null)} statusBarTranslucent>
        <View style={{flex:1,backgroundColor:'#F4F8F5',paddingTop:Platform.OS==='android'?StatusBar.currentHeight||0:0}}>
          <View style={{height:58,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:COLORS.border,flexDirection:'row',alignItems:'center',paddingHorizontal:15,gap:10}}>
            <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={{fontSize:14,fontWeight:'900',color:COLORS.ink}}>{selectedHealthDocumentViewer?.file_name||'Uploaded document'}</Text><Text style={{fontSize:10,color:COLORS.muted}}>Secure document viewer</Text></View>
            <Pressable onPress={()=>setSelectedHealthDocumentViewer(null)} style={{width:38,height:38,borderRadius:19,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={22} color={COLORS.green}/></Pressable>
          </View>
          {selectedHealthDocumentViewer?.preview_url ? (String(selectedHealthDocumentViewer.mime_type||'').toLowerCase().startsWith('image/') ? <View style={{flex:1,padding:10,alignItems:'center',justifyContent:'center'}}><Image source={{uri:selectedHealthDocumentViewer.preview_url}} resizeMode="contain" style={{width:'100%',height:'100%'}}/></View> : <WebView source={{uri:selectedHealthDocumentViewer.preview_url}} style={{flex:1,backgroundColor:'#FFFFFF'}} originWhitelist={['*']} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback/> ) : <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24}}><Ionicons name="document-outline" size={48} color={COLORS.muted}/><Text style={{fontSize:13,color:COLORS.muted,marginTop:10}}>This document is unavailable.</Text></View>}
        </View>
      </Modal>
      <KanevNoticeModal
        visible={notice.visible}
        title={notice.title}
        message={notice.message}
        tone={notice.tone}
        onClose={() => setNotice(current => ({ ...current, visible: false }))}
      />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  authModalOverlay:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:18,paddingVertical:24},
  authModalBackdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(8,28,21,0.58)'},
  authModalCard:{width:'100%',maxWidth:720,maxHeight:'88%',backgroundColor:'#F4F8F5',borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'#DCE9E3',elevation:20,shadowColor:'#001D13',shadowOpacity:0.28,shadowRadius:28,shadowOffset:{width:0,height:12}},
  authModalCardDesktop:{maxWidth:980,maxHeight:'84%'},
  authModalClose:{position:'absolute',right:10,top:10,zIndex:10,width:38,height:38,borderRadius:20,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#E1EAE5'},
  authModalScroll:{padding:14,paddingTop:14,paddingBottom:14},
  authShell:{backgroundColor:'#FFFFFF',borderRadius:22,borderWidth:1,borderColor:'#DCE9E3',overflow:'hidden',marginBottom:22,shadowColor:'#12382B',shadowOpacity:0.08,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:3},
  authShellDesktop:{flexDirection:'row',maxWidth:980,alignSelf:'center',width:'100%',minHeight:570},
  authPromoPanel:{flex:0.92,backgroundColor:'#0B4B38',padding:28,justifyContent:'center',minHeight:300},
  authPromoBadge:{flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start',backgroundColor:'rgba(255,255,255,0.12)',borderRadius:20,paddingHorizontal:12,paddingVertical:8},
  authPromoBadgeText:{color:'#FFFFFF',fontSize:11,fontWeight:'900',letterSpacing:1},
  authOfficialSymbolLogo:{width:112,height:112},
  authOfficialFormSymbolLogo:{width:76,height:76},

  authPromoCircle:{alignSelf:'center',width:145,height:145,borderRadius:48,backgroundColor:'#DDF4E6',alignItems:'center',justifyContent:'center',marginTop:30,marginBottom:23,position:'relative'},
  authPromoPlus:{position:'absolute',right:-5,bottom:3,width:43,height:43,borderRadius:22,backgroundColor:'#D4F879',alignItems:'center',justifyContent:'center',borderWidth:4,borderColor:'#0B4B38'},
  authPromoTitle:{fontSize:29,fontWeight:'900',color:'#FFFFFF',lineHeight:35,textAlign:'center'},
  authPromoCopy:{fontSize:13,lineHeight:21,color:'#D8EAE2',textAlign:'center',marginTop:10,marginBottom:24},
  authBenefit:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12},
  authBenefitText:{fontSize:12,fontWeight:'700',color:'#F2FBF5'},
  authFormPanel:{flex:1,padding:20,minWidth:0,justifyContent:'center'},
  authBrandMini:{width:'100%',alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:15,minHeight:104,gap:2},
  authBrandIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#0B4B38',alignItems:'center',justifyContent:'center'},
  authBrandName:{fontSize:15,fontWeight:'900',color:'#0B4B38'},
  authBrandTag:{fontSize:10,color:'#246EB0',marginTop:2},
  authEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:2,color:'#16805B',marginBottom:7},
  authIntro:{fontSize:12,color:'#718078',lineHeight:19,marginTop:7,marginBottom:8},
  authInputWrap:{minHeight:49,borderWidth:1,borderColor:'#C9DCD3',backgroundColor:'#FBFDFC',borderRadius:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:10},
  authInput:{flex:1,minWidth:0,color:'#173B2D',fontSize:13,paddingVertical:12,outlineStyle:'none'},
  authFieldHint:{fontSize:11,fontWeight:'500',color:'#84948D'},
  authForgot:{alignSelf:'flex-end',paddingVertical:12},
  authForgotText:{fontSize:11,fontWeight:'800',color:'#176BB0'},
  authSubmit:{minHeight:49,borderRadius:12,backgroundColor:'#176BB0',paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  authSubmitText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},
  authSwitchRow:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',alignItems:'center',marginTop:19},
  authSwitchCopy:{fontSize:11,color:'#728078'},
  authSwitchLink:{fontSize:11,fontWeight:'900',color:'#176BB0'},
  authSecureNote:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:21,paddingTop:14,borderTopWidth:1,borderTopColor:'#E6EEE9'},
  authSecureText:{fontSize:10,color:'#728078',flexShrink:1},
  managementAccessCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D7E5DF',borderRadius:14,padding:15,marginTop:18,marginBottom:16},
  managementAccessIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#EAF7EF',alignItems:'center',justifyContent:'center'},
  managementAccessTitle:{fontSize:14,fontWeight:'900',color:'#1D4ED8'},
  managementAccessText:{fontSize:12,color:'#687A72',lineHeight:18,marginTop:4},
  marketPanel:{backgroundColor:'#FFFFFF',borderRadius:18,borderWidth:1,borderColor:'#D7E5DF',padding:18,marginBottom:22},
  roundCategorySection:{backgroundColor:'#F3F5F7',borderRadius:16,paddingVertical:18,paddingHorizontal:18,marginBottom:22},
  roundCategoryScroller:{flexDirection:'row',alignItems:'flex-start',gap:26,paddingHorizontal:4,paddingTop:8,paddingBottom:8},
  roundCategoryItem:{width:112,alignItems:'center',justifyContent:'flex-start',gap:9},
  roundCategoryImageWrap:{width:104,height:104,borderRadius:52,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF',borderWidth:2,borderColor:'#FFFFFF'},
  roundCategoryImage:{width:'100%',height:'100%',borderRadius:52},
  roundCategoryFallback:{width:'100%',height:'100%',borderRadius:52,alignItems:'center',justifyContent:'center'},
  roundCategoryLabel:{fontSize:13,color:'#46515D',fontWeight:'600',textAlign:'center',lineHeight:18,minHeight:36},
  promoTiles:{flexDirection:'row',flexWrap:'wrap',gap:14},
  promoTile:{flex:1,minWidth:230,minHeight:150,borderRadius:14,padding:20,justifyContent:'center'},
  promoTileKicker:{fontSize:11,fontWeight:'900',color:COLORS.green,textTransform:'uppercase',letterSpacing:1},
  promoTileTitle:{fontSize:21,fontWeight:'900',color:COLORS.ink,lineHeight:27,marginTop:9,maxWidth:300},
  promoTileLink:{fontSize:12,fontWeight:'900',color:COLORS.blue,marginTop:14},
  megaCategoryLayout:{flexDirection:'row',flexWrap:'wrap',gap:14,backgroundColor:'#EAF7F7',borderRadius:15,padding:12},
  megaCategoryList:{flex:1,minWidth:220},
  megaCategoryRow:{flexDirection:'row',alignItems:'center',gap:10,padding:10,borderBottomWidth:1,borderBottomColor:'#D6E8E7'},
  megaCategoryIcon:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center'},
  megaCategoryName:{flex:1,fontSize:12,fontWeight:'800',color:COLORS.ink},
  megaCategoryFeature:{flex:2,minWidth:280},
  megaFeatureGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  megaFeatureCard:{flexGrow:1,flexBasis:135,backgroundColor:'#FFFFFF',borderRadius:12,padding:10},
  megaFeatureArt:{height:90,borderRadius:9,alignItems:'center',justifyContent:'center'},
  megaFeatureTitle:{fontSize:12,fontWeight:'900',color:COLORS.ink,marginTop:9},
  megaFeatureSub:{fontSize:10,color:COLORS.blue,marginTop:5},
  carouselSection:{marginBottom:24},
  productCarousel:{gap:12,paddingVertical:4,paddingRight:6},
  carouselProduct:{width:180},
  carouselEmpty:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:13,padding:18,flexDirection:'row',alignItems:'center',gap:12},
  carouselEmptyTitle:{fontSize:13,fontWeight:'900',color:COLORS.ink,marginBottom:4},
  orderVia:{backgroundColor:'#EAF2FD',borderRadius:17,padding:20,marginBottom:24},
  orderViaEyebrow:{fontSize:10,letterSpacing:2,fontWeight:'900',color:COLORS.blue,textAlign:'center'},
  orderViaTitle:{fontSize:24,fontWeight:'900',color:COLORS.ink,textAlign:'center',marginTop:8,marginBottom:16},
  orderViaCards:{flexDirection:'row',flexWrap:'wrap',gap:12},
  orderViaCard:{flex:1,minWidth:250,backgroundColor:'#FFFFFF',borderRadius:13,padding:16,flexDirection:'row',alignItems:'center',gap:12},
  contentEditorial:{marginBottom:24},
  editorialGrid:{flexDirection:'row',flexWrap:'wrap',gap:14},
  editorialCard:{flex:1,minWidth:220,minHeight:232,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:13,padding:0,overflow:'hidden',position:'relative',justifyContent:'flex-end'},
  editorialContentOverlay:{backgroundColor:'transparent',paddingHorizontal:14,paddingVertical:12,marginTop:'auto'},
  editorialImageTitle:{fontSize:12,fontWeight:'800',color:'#FFFFFF',textShadowColor:'rgba(0,0,0,0.78)',textShadowOffset:{width:0,height:1},textShadowRadius:4},
  editorialArt:{height:112,backgroundColor:'#EAF6F0',borderRadius:10,alignItems:'center',justifyContent:'center',marginBottom:12,overflow:'hidden'},
  editorialTitle:{fontSize:14,fontWeight:'900',color:COLORS.ink,marginBottom:7},
  editorialBody:{fontSize:12,lineHeight:19,color:COLORS.muted,minHeight:58,marginBottom:10},
  testimonialPanel:{backgroundColor:'#E7F4FD',borderRadius:17,padding:24,marginBottom:22},
  testimonialQuote:{fontSize:19,fontWeight:'700',lineHeight:29,color:COLORS.ink,marginVertical:13,maxWidth:780},
  faqPanel:{backgroundColor:'#F0F8FF',borderRadius:17,padding:20,marginBottom:22},
  faqRow:{paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#D6E4F1'},
  faqQuestion:{fontSize:14,fontWeight:'900',color:COLORS.ink,marginBottom:6},
  faqAnswer:{fontSize:12,lineHeight:19,color:COLORS.muted},
  tmTopStrip: {backgroundColor:'#E7F4ED',paddingVertical:10,paddingHorizontal:17,flexDirection:'row',justifyContent:'space-between',flexWrap:'wrap',gap:8,borderRadius:9,marginBottom:10},
  tmTopStripText: {fontSize:11,fontWeight:'700',color:COLORS.green},
  tmNavSticky: {backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:COLORS.border,zIndex:1,elevation:1},
  tmNav: {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:8,minHeight:56},
  tmNavLink: {backgroundColor:'#FFFFFF',paddingVertical:11,paddingHorizontal:14,borderRadius:9,borderWidth:1,borderColor:COLORS.border,flexDirection:'row',alignItems:'center',gap:8},
  tmNavText: {fontSize:12,fontWeight:'800',color:COLORS.green},
  tmHero: {backgroundColor:'#E9F7F0',borderRadius:19,padding:23,flexDirection:'row',flexWrap:'wrap',gap:16,marginBottom:15,width:'100%'},
  tmHeroServices: {flex:2,minWidth:280,flexDirection:'row',flexWrap:'wrap',alignContent:'center',gap:10},
  tmServiceTile: {flexGrow:1,flexBasis:150,minWidth:145,minHeight:82,backgroundColor:'#FFFFFF',borderRadius:7,borderWidth:1,borderColor:'#D8E0E8',paddingHorizontal:14,paddingVertical:13,flexDirection:'row',alignItems:'center',gap:12,shadowColor:'#163A2B',shadowOpacity:0.07,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:2},
  tmServiceCopy: {flex:1,minWidth:0},
  tmServiceTitle: {fontSize:14,fontWeight:'800',color:'#152238',lineHeight:19},
  tmServiceSubtitle: {fontSize:12,color:'#687386',marginTop:3,lineHeight:17},
  tmHeroMain: {flex:2,minWidth:260},
  tmEyebrow: {fontSize:11,color:COLORS.green,fontWeight:'900',letterSpacing:1.5,marginBottom:12},
  tmHeadline: {fontSize:34,lineHeight:39,fontWeight:'900',color:COLORS.green,letterSpacing:-1},
  tmHeroDesc: {fontSize:13,lineHeight:21,color:COLORS.muted,marginTop:11,marginBottom:16,maxWidth:450},
  tmLocation: {backgroundColor:'#FFFFFF',padding:11,borderRadius:10,flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start',marginBottom:10},
  tmLocationText: {fontSize:12,fontWeight:'700',color:COLORS.green},
  tmSearchBar: {backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#C5DCCF',padding:9,paddingLeft:13,flexDirection:'row',alignItems:'center',gap:10,minHeight:54},
  tmSearchText: {flex:1,fontSize:12,color:COLORS.muted},
  tmSearchGo: {width:36,height:36,borderRadius:10,backgroundColor:COLORS.green,alignItems:'center',justifyContent:'center'},
  tmTrust: {flexDirection:'row',flexWrap:'wrap',gap:15,marginTop:15},
  tmTrustText: {fontSize:11,color:COLORS.green,fontWeight:'700'},
  tmHeroSide: {flex:1,minWidth:160,alignItems:'center',justifyContent:'center',backgroundColor:'#D5F0DF',padding:20,borderRadius:16},
  tmIllustration: {width:132,height:132,backgroundColor:'#FFFFFF',borderRadius:66,alignItems:'center',justifyContent:'center',position:'relative'},
  tmIllustrationPlus: {position:'absolute',bottom:4,right:0,backgroundColor:'#C8F17B',width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},
  tmHeroSideTitle: {fontSize:17,fontWeight:'900',color:COLORS.green,marginTop:14},
  tmHeroSideText: {fontSize:11,color:COLORS.muted,textAlign:'center',marginTop:5,lineHeight:17},
  tmQuickActions: {flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:18},
  tmQuickCard: {flex:1,minWidth:240,flexDirection:'row',alignItems:'center',gap:12,padding:16,backgroundColor:'#FFFFFF',borderRadius:14,borderWidth:1,borderColor:COLORS.border},
  tmQuickIcon: {width:51,height:51,borderRadius:14,backgroundColor:'#E9F6EE',alignItems:'center',justifyContent:'center'},
  tmQuickTitle: {fontSize:14,fontWeight:'900',color:COLORS.ink},
  tmQuickSubtitle: {fontSize:11,color:COLORS.muted,lineHeight:17,marginTop:4},
  tmPromoBanner: {backgroundColor:COLORS.green,borderRadius:17,padding:22,flexDirection:'row',alignItems:'center',gap:10,marginBottom:21},
  tmPromoEyebrow: {fontSize:10,color:'#B8F1D1',fontWeight:'900',letterSpacing:1},
  tmPromoTitle: {fontSize:22,color:'#FFFFFF',fontWeight:'900',lineHeight:28,marginTop:6,maxWidth:440},
  tmPromoSub: {fontSize:12,color:'#D4EDE1',marginTop:7},
  tmPromoButton: {backgroundColor:'#C7F47A',paddingHorizontal:17,paddingVertical:11,borderRadius:9,alignSelf:'flex-start',marginTop:14},
  tmPromoButtonText: {fontWeight:'900',color:COLORS.green,fontSize:12},
  tmCategoryGrid: {flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:23},
  tmCategoryCard: {flexGrow:1,flexBasis:130,minHeight:128,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:14,alignItems:'center',justifyContent:'center',padding:12,gap:10},
  tmCategoryCircle: {width:64,height:64,borderRadius:32,alignItems:'center',justifyContent:'center'},
  tmCategoryLabel: {fontSize:12,color:COLORS.ink,fontWeight:'800',textAlign:'center'},
  tmHelpBanner: {backgroundColor:'#E9F6EF',borderRadius:15,padding:17,flexDirection:'row',alignItems:'center',gap:14,marginTop:20},

  desktopHeaderTools:{flex:1,flexDirection:'row',alignItems:'center',gap:14,marginLeft:28,minWidth:0},
  headerLogoHolder:{width:68,height:68,alignItems:'center',justifyContent:'center',flexShrink:0},headerLogoImage:{width:68,height:68,borderRadius:10},
  desktopSearchWrap:{flex:1,minWidth:160,position:'relative',zIndex:1000,elevation:30},
  headerSearchDropdown:{position:'absolute',top:55,left:0,right:0,maxHeight:430,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:15,overflow:'hidden',zIndex:2000,elevation:40,shadowColor:'#17382B',shadowOpacity:.14,shadowRadius:16,shadowOffset:{width:0,height:8}},
  mobileHeaderSearchWrap:{position:'relative',zIndex:15,backgroundColor:'#FFFFFF',paddingHorizontal:13,paddingVertical:10,borderBottomWidth:1,borderBottomColor:COLORS.border},mobileHeaderSearch:{position:'relative',height:45,borderWidth:1,borderColor:'#D7E1E8',borderRadius:24,backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',paddingLeft:12,paddingRight:4,gap:8},mobileHeaderSearchInput:{flex:1,minWidth:0,fontSize:12,color:COLORS.ink,outlineStyle:'none'},mobileHeaderSearchButton:{height:36,paddingHorizontal:13,borderRadius:19,backgroundColor:COLORS.blue,alignItems:'center',justifyContent:'center'},mobileHeaderSearchDropdown:{position:'absolute',top:58,left:13,right:13,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:15,overflow:'hidden',zIndex:60,elevation:14,shadowColor:'#17382B',shadowOpacity:.14,shadowRadius:16,shadowOffset:{width:0,height:8}},
  headerSearchResult:{minHeight:58,paddingHorizontal:12,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:'#EEF2F0'},headerSearchResultIcon:{width:38,height:38,borderRadius:10,backgroundColor:'#EFF7F2',alignItems:'center',justifyContent:'center'},headerSearchResultName:{fontSize:12,fontWeight:'800',color:COLORS.ink},headerSearchResultMeta:{fontSize:10,color:COLORS.muted,marginTop:3},headerSearchResultPrice:{fontSize:12,fontWeight:'900',color:COLORS.green},headerSearchNoResult:{padding:16,fontSize:12,color:COLORS.muted},headerSearchAll:{minHeight:42,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#F7FBF8'},headerSearchAllText:{fontSize:11,fontWeight:'900',color:COLORS.blue},
  deliveryModalOverlay:{flex:1,justifyContent:'center',alignItems:'center',padding:18},deliveryModalCard:{width:'100%',maxWidth:510,backgroundColor:'#FFFFFF',borderRadius:22,padding:20,borderWidth:1,borderColor:COLORS.border,elevation:22,shadowColor:'#001D13',shadowOpacity:.25,shadowRadius:25,shadowOffset:{width:0,height:10}},deliveryModalHeader:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10},deliveryModalIcon:{width:46,height:46,borderRadius:15,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},deliveryModalTitle:{fontSize:18,fontWeight:'900',color:COLORS.ink},deliveryModalSub:{fontSize:11,lineHeight:16,color:COLORS.muted,marginTop:3},deliveryMapButton:{minHeight:46,borderWidth:1,borderColor:'#D8E7F3',backgroundColor:'#F4F9FD',borderRadius:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:9,marginTop:10},deliveryMapButtonText:{fontSize:12,fontWeight:'800',color:COLORS.blue,flex:1},deliveryCurrentButton:{minHeight:46,borderWidth:1,borderColor:'#D6E8DC',backgroundColor:'#F3FAF5',borderRadius:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:9,marginTop:9},deliveryCurrentText:{fontSize:12,fontWeight:'800',color:COLORS.green},deliveryModalHint:{fontSize:10,lineHeight:15,color:COLORS.muted,marginTop:12},deliveryModalActions:{flexDirection:'row',justifyContent:'flex-end',gap:9,marginTop:18},deliveryCancelButton:{minHeight:42,paddingHorizontal:16,borderRadius:11,borderWidth:1,borderColor:COLORS.border,alignItems:'center',justifyContent:'center'},deliveryCancelText:{fontSize:12,fontWeight:'800',color:COLORS.ink},deliverySaveButton:{minHeight:42,paddingHorizontal:18,borderRadius:11,backgroundColor:COLORS.green,alignItems:'center',justifyContent:'center'},deliverySaveText:{fontSize:12,fontWeight:'900',color:'#FFFFFF'},
  desktopDelivery:{minHeight:48,paddingHorizontal:12,borderRightWidth:1,borderRightColor:COLORS.border,flexDirection:'row',alignItems:'center',gap:7},
  desktopDeliveryLabel:{fontSize:10,color:COLORS.muted},desktopDeliveryValue:{fontSize:12,color:COLORS.ink,fontWeight:'800'},
  desktopSearch:{position:'relative',flex:1,minWidth:160,height:48,borderWidth:1,borderColor:'#D7E1E8',borderRadius:25,backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',paddingLeft:14,paddingRight:4,gap:9},
  desktopSearchInput:{flex:1,minWidth:0,fontSize:12,color:COLORS.ink,outlineStyle:'none'},rotatingPlaceholderClip:{position:'absolute',left:40,right:100,top:15,height:18,overflow:'hidden',flexDirection:'row',alignItems:'center'},rotatingPlaceholderClipMobile:{position:'absolute',left:40,right:100,top:14,height:18,overflow:'hidden',flexDirection:'row',alignItems:'center'},rotatingProductClip:{height:18,overflow:'hidden',justifyContent:'center',flex:1,minWidth:0},rotatingPlaceholderText:{fontSize:12,color:'#7C8A84'},desktopSearchButton:{height:39,paddingHorizontal:18,borderRadius:22,backgroundColor:COLORS.blue,alignItems:'center',justifyContent:'center'},desktopSearchButtonText:{fontSize:12,color:'#FFFFFF',fontWeight:'900'},
  desktopHeaderLink:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:4},desktopHeaderLinkText:{fontSize:12,color:COLORS.blue,fontWeight:'700'},desktopCart:{flexDirection:'row',alignItems:'center',gap:5,paddingLeft:2},
  tmSearchInput:{flex:1,minWidth:0,fontSize:12,color:COLORS.ink,outlineStyle:'none',paddingVertical:7},
  fullFooter:{marginTop:28,backgroundColor:'#EAF6FC',marginHorizontal:-32,paddingHorizontal:32,paddingTop:32,paddingBottom:0,borderTopWidth:1,borderTopColor:'#D8E9F0'},
  footerTop:{flexDirection:'row',flexWrap:'wrap',gap:30,paddingBottom:28},footerAbout:{flex:2,minWidth:220,maxWidth:370},footerLogoRow:{flexDirection:'row',alignItems:'center',gap:10},footerLogo:{width:39,height:39,borderRadius:12,backgroundColor:COLORS.green,alignItems:'center',justifyContent:'center'},footerAboutCopy:{fontSize:12,lineHeight:19,color:'#526C7A',marginTop:14,maxWidth:330},
  footerColumn:{flex:1,minWidth:145,gap:11},footerColumnTitle:{fontSize:13,fontWeight:'900',color:COLORS.ink,marginBottom:3},footerLink:{fontSize:11,lineHeight:17,color:'#4D6D7D'},footerBottom:{borderTopWidth:1,borderTopColor:'#D5E7EF',minHeight:55,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8,paddingVertical:13},footerBottomText:{fontSize:10,color:'#66808D'},
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { position: 'relative', zIndex: 1000, elevation: 30, minHeight: 76, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logoMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoPlus: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  brandName: { color: COLORS.green, fontWeight: '900', fontSize: 18, letterSpacing: -0.4 },
  tagline: { color: COLORS.blue, fontSize: 11, marginTop: 2, fontWeight: '600' },
  cartHeader: { width: 43, height: 43, borderRadius: 14, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center' },
  cartDot: { position: 'absolute', top: -4, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartDotText: { color: COLORS.green, fontSize: 10, fontWeight: '900' },
  scroll: { flex: 1 },
  pageContent: { paddingHorizontal: 18, paddingTop: 19, paddingBottom: 28, maxWidth: 1320, width: '100%', alignSelf: 'center' },
  pageContentDesktop: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40, maxWidth: 1320 },
  pageContentTablet: { paddingHorizontal: 24, paddingTop: 20 },
  pageContentMobile: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 22 },
  headerDesktop: { paddingHorizontal: 32, minHeight: 82 },
  headerCompact: { paddingHorizontal: 14, minHeight: 56, paddingVertical: 7, gap: 6 },
  tabBarDesktop: { display: 'none' },
  hero: { backgroundColor: COLORS.green, borderRadius: 25, padding: 22, minHeight: 220, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', gap: 10 },
  heroEyebrow: { color: '#B9F1C8', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 10 },
  heroTitle: { color: '#FFFFFF', fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, maxWidth: 340 },
  heroBody: { color: '#E2F1E8', fontSize: 13, lineHeight: 19, marginTop: 9, maxWidth: 340 },
  heroButton: { marginTop: 17, backgroundColor: COLORS.lime, alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroButtonText: { color: COLORS.green, fontWeight: '900', fontSize: 12 },
  heroIconCircle: { width: 78, height: 78, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { marginTop: 27, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  link: { color: COLORS.green, fontWeight: '800', fontSize: 12 },
  categoryCard: { width: 104, paddingVertical: 15, paddingHorizontal: 9, backgroundColor: '#FFFFFF', borderRadius: 17, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  categoryIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  categoryName: { color: COLORS.ink, fontWeight: '700', fontSize: 11, textAlign: 'center' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  productCard: { width: '19%', flexGrow: 0, flexShrink: 0, flexBasis: '19%', maxWidth: '19%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 9, borderWidth: 1, borderColor: '#E3ECE6', minWidth: 0, shadowColor: '#173D2C', shadowOpacity: 0.045, shadowRadius: 7, shadowOffset: {width:0,height:3}, elevation: 1 },
  productImage: { height: 145, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 5, position: 'relative', overflow: 'hidden' },
  ratingBadge: {position:'absolute',top:7,left:7,backgroundColor:'#139FDB',borderRadius:12,paddingHorizontal:7,paddingVertical:3,flexDirection:'row',alignItems:'center',gap:3},
  ratingBadgeText: {color:'#FFFFFF',fontSize:10,fontWeight:'900'},
  discountBadge: {position:'absolute',top:7,right:7,backgroundColor:'#FF7417',borderRadius:4,paddingHorizontal:6,paddingVertical:4},
  discountBadgeText: {color:'#FFFFFF',fontSize:10,fontWeight:'900'},
  originalPrice: {color:'#9AA3A0',fontSize:10,fontWeight:'700',textDecorationLine:'line-through'},
  productBadge: { position: 'absolute', top: 8, left: 8, overflow: 'hidden', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, color: COLORS.green, backgroundColor: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  productCategory: { display: 'none' },
  productName: { color: COLORS.ink, fontSize: 12, lineHeight: 16, fontWeight: '800', minHeight: 0, marginTop: 3, marginBottom: 0 },
  productDescription: { display: 'none' },
  productBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, gap: 5 },
  priceRow: {flex:1,minWidth:0,flexDirection:'row',alignItems:'baseline',flexWrap:'wrap',columnGap:5,rowGap:0},
  price: { color: COLORS.green, fontSize: 14, fontWeight: '900' },
  addButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  supportBanner: { marginTop: 24, padding: 16, borderRadius: 17, backgroundColor: '#EAF4EE', flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '900' },
  supportText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  homeSearchWrap: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 21, borderWidth: 1, borderColor: COLORS.border, marginBottom: 15 },
  homeEyebrow: { color: COLORS.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  homeHeading: { color: COLORS.ink, fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  homeHeadingAccent: { color: COLORS.green, fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  homeIntro: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 560 },
  homeSearch: { minHeight: 54, marginTop: 18, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#D5E7DD', backgroundColor: '#F8FCF9', flexDirection: 'row', alignItems: 'center', gap: 10 },
  homeSearchPlaceholder: { flex: 1, color: COLORS.muted, fontSize: 12 },
  homeTrustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 16 },
  homeTrustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  homeTrustText: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  homePromo: { minHeight: 205, backgroundColor: COLORS.green, borderRadius: 22, padding: 21, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  homePromoEyebrow: { color: '#BEE8CE', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9 },
  homePromoTitle: { color: '#FFFFFF', fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5, maxWidth: 410 },
  homePromoCopy: { color: '#E0F0E6', fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 400 },
  homePromoButton: { marginTop: 15, backgroundColor: COLORS.lime, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  homePromoButtonText: { color: COLORS.green, fontSize: 11, fontWeight: '900' },
  homePromoArt: { width: 76, height: 76, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  homePromoPlus: { position: 'absolute', right: -4, bottom: -4, width: 29, height: 29, borderRadius: 10, backgroundColor: COLORS.lime, alignItems: 'center', justifyContent: 'center' },
  homeSectionSub: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  homeCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  homeCategoryTile: { flexGrow: 1, flexBasis: 135, minHeight: 76, padding: 11, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 9 },
  homeCategoryIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  homeCategoryName: { flex: 1, color: COLORS.ink, fontSize: 11, fontWeight: '800' },
  homeLoading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, marginBottom: 12 },
  homeCarePanel: { marginTop: 23, padding: 16, borderRadius: 17, backgroundColor: '#EAF4EE', flexDirection: 'row', alignItems: 'center', gap: 12 },
  homeCareIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  homeBottomNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 22, paddingHorizontal: 12 },
  homeBottomText: { color: COLORS.muted, fontSize: 10, lineHeight: 15, flexShrink: 1, textAlign: 'center' },
  pageTitle: { fontSize: 27, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13, lineHeight: 19, color: COLORS.muted, marginTop: 5, marginBottom: 17 },
  searchResultsHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:4},
  clearSearchAction:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:8,borderRadius:18,backgroundColor:'#EAF6EE',flexShrink:0},
  clearSearchActionText:{fontSize:11,fontWeight:'800',color:COLORS.green},
  searchEmptyState:{alignItems:'center',backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:18,padding:25,marginTop:12,marginBottom:20},
  searchEmptyIcon:{width:60,height:60,borderRadius:30,backgroundColor:'#EAF6EE',alignItems:'center',justifyContent:'center',marginBottom:13},
  searchEmptyActions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:9,marginTop:15},
  searchBox: { height: 49, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 13, outlineStyle: 'none' },
  filterChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  filterChipText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },
  filterChipTextActive: { color: '#FFFFFF' },
  resultsText: { color: COLORS.muted, fontSize: 11, marginBottom: 12, fontWeight: '700' },
  emptyState: { padding: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, alignItems: 'center', gap: 9, marginTop: 8 },
  emptyTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '900', marginTop: 4 },
  emptyBody: { color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  actionButton: { minHeight: 47, borderRadius: 13, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17, marginTop: 13 },
  actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryButton: { backgroundColor: COLORS.pale, borderWidth: 1, borderColor: '#D5E8DC' },
  commercePage:{width:'100%',maxWidth:1220,alignSelf:'center'},
  commerceHeadingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'},
  cartCountPill:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,paddingVertical:9,borderRadius:22,backgroundColor:'#EAF4EE',borderWidth:1,borderColor:'#D4E8DC'},
  cartCountPillText:{fontSize:11,fontWeight:'900',color:COLORS.green},
  checkoutTrustRow:{flexDirection:'row',flexWrap:'wrap',gap:10,padding:13,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:14,marginBottom:18},
  checkoutTrustItem:{flexDirection:'row',alignItems:'center',gap:7,flexGrow:1,flexBasis:140},checkoutTrustText:{fontSize:11,color:COLORS.muted,fontWeight:'700'},
  cartEmptyCard:{alignItems:'center',justifyContent:'center',paddingHorizontal:24,paddingVertical:38,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:20,marginBottom:20},
  cartEmptyIcon:{width:78,height:78,borderRadius:25,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center',marginBottom:10},
  commerceColumns:{flexDirection:'column',gap:16,alignItems:'stretch'},commerceColumnsDesktop:{flexDirection:'row',alignItems:'flex-start'},
  cartProductsPanel:{flex:1,minWidth:0,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:18,padding:14},cartProductsPanelDesktop:{flex:1.8,padding:20},
  panelHeadingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingBottom:13,borderBottomWidth:1,borderBottomColor:'#E8EFEB'},
  panelHeading:{fontSize:15,fontWeight:'900',color:COLORS.ink},clearCartText:{fontSize:11,fontWeight:'800',color:'#1D4ED8',padding:6},
  cartProductRow:{flexDirection:'row',alignItems:'flex-start',gap:12,paddingVertical:16,borderBottomWidth:1,borderBottomColor:'#EDF2EF'},
  cartProductImage:{width:78,height:84,borderRadius:13,alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0},cartProductInfo:{flex:1,minWidth:0},
  cartProductCategory:{fontSize:9,fontWeight:'900',letterSpacing:.7,color:COLORS.blue,marginBottom:4},cartProductBrand:{fontSize:11,color:COLORS.muted,marginTop:3},
  cartProductActions:{flexDirection:'row',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:10},qtyControl:{flexDirection:'row',alignItems:'center',gap:0,borderWidth:1,borderColor:'#D8E6DE',borderRadius:9,overflow:'hidden'},qtyControlButton:{width:32,height:30,alignItems:'center',justifyContent:'center',backgroundColor:'#F2F8F4'},qtyControlValue:{minWidth:32,textAlign:'center',fontSize:12,fontWeight:'900',color:COLORS.ink},
  removeCartButton:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:6,paddingHorizontal:2},removeCartText:{fontSize:11,fontWeight:'800',color:'#1D4ED8'},
  cartProductLineTotal:{alignItems:'flex-end',minWidth:65,paddingTop:2},cartLineCaption:{fontSize:9,color:COLORS.muted,marginTop:4},
  prescriptionTag:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:5,backgroundColor:'#FFF5D9',borderRadius:6,paddingHorizontal:7,paddingVertical:5,marginTop:7},prescriptionTagText:{fontSize:9,fontWeight:'800',color:'#8A5A00'},
  continueShoppingLink:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:7,paddingVertical:15},continueShoppingText:{fontSize:12,fontWeight:'900',color:COLORS.green},
  orderSummaryCard:{width:'100%',backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:18,padding:17,marginTop:0},orderSummaryCardDesktop:{width:340,flexShrink:0,padding:20},
  summaryLine:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginTop:13},summaryLabel:{fontSize:12,color:COLORS.muted,flex:1},summaryValue:{fontSize:12,fontWeight:'800',color:COLORS.ink},summaryValuePending:{fontSize:10,fontWeight:'800',color:COLORS.green,textAlign:'right',maxWidth:150},
  summaryDivider:{height:1,backgroundColor:'#E7EFEB',marginVertical:15},summaryTotalLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},summaryTotalLabel:{fontSize:13,fontWeight:'900',color:COLORS.ink},summaryTotalValue:{fontSize:22,fontWeight:'900',color:COLORS.green},summaryNote:{fontSize:10,lineHeight:16,color:COLORS.muted,marginTop:12},summarySecure:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:'#E8EFEB'},summarySecureText:{fontSize:10,color:COLORS.muted,flexShrink:1},
  checkoutBackLink:{flexDirection:'row',alignItems:'center',gap:7,alignSelf:'flex-start',paddingVertical:4,marginBottom:10},
  checkoutProgress:{flexDirection:'row',alignItems:'center',paddingVertical:15,paddingHorizontal:10,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:14,marginBottom:17},checkoutProgressStep:{flex:1,flexDirection:'row',alignItems:'center',gap:7,minWidth:0},checkoutStepCircle:{width:27,height:27,borderRadius:14,backgroundColor:'#EDF2EF',alignItems:'center',justifyContent:'center'},checkoutStepCircleActive:{backgroundColor:COLORS.green},checkoutStepNumber:{fontSize:11,fontWeight:'900',color:COLORS.muted},checkoutStepNumberActive:{color:'#FFFFFF'},checkoutStepLabel:{fontSize:10,fontWeight:'700',color:COLORS.muted,flexShrink:1},checkoutStepLine:{height:1,flex:0.35,backgroundColor:'#E1EAE5',marginHorizontal:4},
  checkoutDetailsPanel:{flex:1,minWidth:0,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:18,padding:16},checkoutDetailsPanelDesktop:{padding:22},checkoutSectionHeading:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:7},checkoutSectionIcon:{width:40,height:40,borderRadius:12,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},checkoutSectionSub:{fontSize:11,color:COLORS.muted,marginTop:4,lineHeight:16},
  checkoutFieldsGrid:{flexDirection:'row',gap:13},checkoutFieldHalf:{flex:1,minWidth:0},fieldHelper:{fontSize:10,color:COLORS.muted,marginTop:6},checkoutFormDivider:{height:1,backgroundColor:'#E8EFEB',marginVertical:20},
  fulfilmentChoices:{gap:9,marginTop:9,marginBottom:8},fulfilmentChoice:{flexDirection:'row',alignItems:'center',gap:11,padding:12,borderWidth:1,borderColor:COLORS.border,borderRadius:13,backgroundColor:'#FFFFFF'},fulfilmentChoiceActive:{borderColor:'#6BA88A',backgroundColor:'#F3FAF5'},fulfilmentChoiceIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#F1F6F3',alignItems:'center',justifyContent:'center'},fulfilmentChoiceIconActive:{backgroundColor:COLORS.green},fulfilmentChoiceTitle:{fontSize:12,fontWeight:'900',color:COLORS.ink},fulfilmentChoiceSub:{fontSize:10,color:COLORS.muted,marginTop:4,lineHeight:15},
  checkoutLocationButton:{flexDirection:'row',alignItems:'center',gap:10,padding:11,borderWidth:1,borderColor:'#D7E6DD',borderRadius:12,marginTop:10,marginBottom:5,backgroundColor:'#F8FCF9'},checkoutLocationIcon:{width:36,height:36,borderRadius:10,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},checkoutLocationTitle:{fontSize:11,fontWeight:'900',color:COLORS.green},checkoutLocationSub:{fontSize:10,color:COLORS.muted,marginTop:3},
  deliveryInfoNotice:{flexDirection:'row',alignItems:'flex-start',gap:9,backgroundColor:'#EEF5FC',padding:12,borderRadius:11,marginTop:13},deliveryInfoNoticeText:{flex:1,fontSize:11,color:'#365D7C',lineHeight:17},pharmacyReviewNotice:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:'#F0F8F2',padding:13,borderRadius:12,marginTop:18},pharmacyReviewTitle:{fontSize:11,fontWeight:'900',color:COLORS.green},pharmacyReviewText:{fontSize:10,color:COLORS.muted,lineHeight:16,marginTop:4},
  checkoutSummaryCount:{fontSize:11,color:COLORS.muted,marginTop:5,marginBottom:7},checkoutSummaryProduct:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#EDF2EF'},checkoutSummaryThumb:{width:45,height:47,borderRadius:9,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center',overflow:'hidden'},checkoutSummaryProductName:{fontSize:11,fontWeight:'800',color:COLORS.ink,lineHeight:15},checkoutSummaryProductMeta:{fontSize:10,color:COLORS.muted,marginTop:4},checkoutSummaryProductPrice:{fontSize:11,fontWeight:'900',color:COLORS.ink},
  cartItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  cartItemIcon: { width: 54, height: 58, borderRadius: 13, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center' },
  cartItemName: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  cartItemPrice: { color: COLORS.green, fontWeight: '800', fontSize: 12, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  qtyButton: { width: 27, height: 27, borderRadius: 8, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 12, fontWeight: '900', color: COLORS.ink },
  lineTotal: { color: COLORS.ink, fontWeight: '900', fontSize: 13 },
  totalCard: { padding: 17, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 },
  totalLabel: { color: COLORS.muted, fontSize: 12, flex: 1 },
  totalValue: { color: COLORS.ink, fontSize: 13, fontWeight: '900' },
  smallNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 12 },
  formCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 16 },
  fieldLabel: { color: COLORS.ink, fontSize: 12, fontWeight: '800', marginTop: 13, marginBottom: 7 },
  fieldInput: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FBFDFC', minHeight: 45, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11, color: COLORS.ink, fontSize: 13 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  choiceActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  choiceText: { fontSize: 12, fontWeight: '800', color: COLORS.green },
  myAccountHero:{backgroundColor:COLORS.green,borderRadius:20,padding:20,marginBottom:18,overflow:'hidden'},
  myAccountAvatarWrap:{alignItems:'center',justifyContent:'center',marginRight:12,minWidth:76},
  myAccountAvatarPhoto:{width:'100%',height:'100%',borderRadius:999},
  myAccountAvatarCamera:{position:'absolute',right:-2,bottom:-2,width:27,height:27,borderRadius:14,backgroundColor:COLORS.blue,borderWidth:2,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  myAccountAvatarAction:{fontSize:10,fontWeight:'900',color:'#D4F879',marginTop:7},
  myAccountAvatarRemove:{fontSize:10,fontWeight:'700',color:'#F4C6C6',marginTop:4},
  myAccountHeroDesktop:{padding:25},myAccountGreetingRow:{flexDirection:'row',alignItems:'center',gap:13,flexWrap:'wrap'},
  myAccountAvatar:{width:62,height:62,borderRadius:31,backgroundColor:'#E8F2FF',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'rgba(255,255,255,0.25)'},
  myAccountAvatarText:{fontSize:27,fontWeight:'900',color:COLORS.blue},myAccountEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.5,color:'#C7EAD8',marginBottom:4},
  myAccountWelcome:{fontSize:25,lineHeight:31,fontWeight:'900',color:'#FFFFFF'},myAccountSub:{fontSize:12,color:'#DCEFE5',marginTop:3},
  myAccountSignOut:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:9,borderRadius:10,backgroundColor:'#FFFFFF',marginLeft:'auto'},myAccountSignOutText:{fontSize:11,fontWeight:'800',color:'#B42332'},
  myAccountTrustLine:{marginTop:19,paddingTop:14,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.18)',flexDirection:'row',alignItems:'center',gap:7,flexWrap:'wrap'},myAccountTrustText:{fontSize:11,fontWeight:'700',color:'#FFFFFF'},myAccountTagline:{fontSize:10,color:'#D1E9DD',marginLeft:'auto'},
  myAccountLayout:{flexDirection:'column',gap:16},myAccountLayoutDesktop:{flexDirection:'row',alignItems:'flex-start'},
  myAccountSidebar:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:16,overflow:'hidden'},
  myAccountMenuHeading:{paddingHorizontal:17,paddingVertical:15,fontSize:11,fontWeight:'900',color:COLORS.ink,borderBottomWidth:1,borderBottomColor:COLORS.border,letterSpacing:.6},
  myAccountMenuItem:{minHeight:51,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:'#EDF1EF'},myAccountMenuItemActive:{backgroundColor:'#F0F6FC'},myAccountMenuText:{fontSize:12,fontWeight:'700',color:'#4C6258',flex:1},myAccountMenuTextActive:{color:COLORS.blue,fontWeight:'900'},
  myAccountCount:{minWidth:22,height:22,borderRadius:11,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},myAccountCountText:{fontSize:10,fontWeight:'900',color:COLORS.green},
  myAccountSidebarFooter:{padding:15,flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#F4FAF6'},myAccountSidebarFooterText:{fontSize:10,color:COLORS.muted,flex:1},
  myAccountMain:{flex:1,minWidth:0,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:16,padding:17},
  myAccountSectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:14},myAccountSectionTitle:{fontSize:18,fontWeight:'900',color:COLORS.ink},myAccountSectionSub:{fontSize:11,color:COLORS.muted,marginTop:4,lineHeight:16},
  myAccountAccountNumber:{alignItems:'flex-end'},myAccountAccountNumberLabel:{fontSize:9,color:COLORS.muted,fontWeight:'800',letterSpacing:.8},myAccountAccountNumberValue:{fontSize:11,color:COLORS.blue,fontWeight:'800',marginTop:4},
  myAccountInfoGrid:{flexDirection:'row',flexWrap:'wrap',borderWidth:1,borderColor:COLORS.border,borderRadius:12,overflow:'hidden',marginBottom:24},
  myAccountInfoCell:{width:'50%',minHeight:85,padding:13,flexDirection:'row',alignItems:'flex-start',gap:10,borderBottomWidth:1,borderRightWidth:1,borderColor:COLORS.border},
  myAccountInfoIcon:{width:31,height:31,borderRadius:9,backgroundColor:'#EFF6FC',alignItems:'center',justifyContent:'center'},myAccountInfoLabel:{fontSize:9,color:COLORS.muted,fontWeight:'900',letterSpacing:.5,marginBottom:5},myAccountInfoValue:{fontSize:12,color:COLORS.ink,fontWeight:'700',lineHeight:17},
  myAccountSmallNote:{fontSize:10,color:COLORS.muted},myAccountQuickGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  myAccountQuickCard:{flexDirection:'row',alignItems:'center',gap:11,padding:13,borderWidth:1,borderColor:COLORS.border,borderRadius:12,minHeight:78,flexGrow:1,flexBasis:220,backgroundColor:'#FFFFFF'},
  myAccountQuickIcon:{width:39,height:39,borderRadius:11,backgroundColor:'#EFF6FC',alignItems:'center',justifyContent:'center'},myAccountQuickTitle:{fontSize:12,fontWeight:'900',color:COLORS.ink},myAccountQuickSub:{fontSize:10,color:COLORS.muted,lineHeight:15,marginTop:4},
  myAccountHelpBanner:{marginTop:15,padding:14,borderRadius:12,backgroundColor:'#EAF5EE',flexDirection:'row',alignItems:'center',gap:11},myAccountHelpIcon:{width:40,height:40,borderRadius:12,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},myAccountTextLink:{fontSize:11,fontWeight:'900',color:COLORS.blue},
  myAccountEmpty:{padding:25,alignItems:'center',borderWidth:1,borderColor:COLORS.border,borderRadius:13,backgroundColor:'#FBFDFC'},myAccountEmptyIcon:{width:56,height:56,borderRadius:18,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},myAccountEmptyTitle:{fontSize:16,fontWeight:'900',color:COLORS.ink,marginTop:12},myAccountEmptyCopy:{fontSize:12,color:COLORS.muted,lineHeight:18,textAlign:'center',maxWidth:340,marginTop:6},myAccountOrderRow:{flexDirection:'row',alignItems:'center',gap:12,padding:12,borderWidth:1,borderColor:COLORS.border,borderRadius:12,marginBottom:9},myAccountOrderIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},
  accountHero: { padding: 22, backgroundColor: COLORS.pale, borderRadius: 20, alignItems: 'center', marginBottom: 14 },
  accountAvatar: { width: 65, height: 65, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  accountHeading: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  accountCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6, maxWidth: 320 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, marginBottom: 9 },
  accountRowIcon: { width: 41, height: 41, borderRadius: 13, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center' },
  accountRowTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  accountRowSub: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  disclaimer: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 13, borderRadius: 13, backgroundColor: '#EAF4EE', marginTop: 8 },
  disclaimerText: { color: COLORS.green, flex: 1, fontSize: 11, lineHeight: 17 },
  detailWrap: { backgroundColor: '#FFFFFF', padding: 17, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  backText: { color: COLORS.green, fontSize: 12, fontWeight: '800' },
  detailImage: { height: 220, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  detailTitle: { color: COLORS.ink, fontSize: 25, fontWeight: '900', marginTop: 5 },
  detailPrice: { color: COLORS.green, fontSize: 22, fontWeight: '900', marginTop: 10 },
  detailDescription: { color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 15 },
  detailNotice: { color: COLORS.blue, fontSize: 12, lineHeight: 18, backgroundColor: '#EEF4FA', padding: 12, borderRadius: 12, marginTop: 18 },
  footer: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 12 },
  footerBrand: { color: COLORS.green, fontWeight: '900', fontSize: 14 },
  footerTagline: { color: COLORS.blue, fontWeight: '700', fontSize: 11, marginTop: 3 },
  footerSmall: { color: COLORS.muted, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 10, maxWidth: 340 },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 30, minHeight: 66, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 12 : 5 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIconWrap: { width: 42, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabIconWrapActive: { backgroundColor: COLORS.pale },
  tabBadge: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.lime, top: 2, right: 7 },
  tabLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  tabLabelActive: { color: COLORS.green, fontWeight: '900' }
});
