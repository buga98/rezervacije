const CACHE='lp-rezervacije-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
self.addEventListener('push',event=>{
  const data=event.data?.json()||{};
  event.waitUntil(self.registration.showNotification(data.title||'Nova obavijest',{body:data.body||'',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:data.url||'/dashboard'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url||'/dashboard'));
});
