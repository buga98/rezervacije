"use client";
import { useState } from "react";
import { Bell } from "lucide-react";

function urlBase64ToUint8Array(base64String:string){const padding="=".repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
export function PushEnable(){
 const [state,setState]=useState<"idle"|"busy"|"done"|"error">("idle");
 async function enable(){try{setState("busy");if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error();const perm=await Notification.requestPermission();if(perm!=="granted")throw new Error();const reg=await navigator.serviceWorker.register("/sw.js");const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)throw new Error();const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});const r=await fetch("/api/admin/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(sub)});if(!r.ok)throw new Error();setState("done")}catch{setState("error")}}
 return <button className="btn" onClick={enable} disabled={state==="busy"||state==="done"}><Bell size={16}/>{state==="done"?"Obavijesti uključene":state==="busy"?"Uključujem…":state==="error"?"Pokušaj ponovno":"Uključi obavijesti"}</button>
}
