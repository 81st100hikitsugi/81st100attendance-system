import {initializeApp} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {getFirestore,collection,getDocs,doc,getDoc,writeBatch} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {db} from "../../shared/firebase.js";
import {requireUser} from "../../shared/auth.js";
import {mountAppShell} from "../../shared/app-shell.js";

const $=id=>document.getElementById(id);
const collections=["learningInfos","searchDictionary","subjectDocuments"];
const sourceApp=initializeApp({
  apiKey:"AIzaSyAESnBMgGQQKRcPE7J9OzuW04YX7SWUOWc",
  authDomain:"learning-info-site.firebaseapp.com",
  projectId:"learning-info-site",
  storageBucket:"learning-info-site.firebasestorage.app",
  messagingSenderId:"51499093370",
  appId:"1:51499093370:web:18b9c262196fda01d29ac3"
},"learning-source-migration");
const sourceAuth=getAuth(sourceApp),sourceDb=getFirestore(sourceApp);
let connected=false,sourceData=null,backupSaved=false,migrationBusy=false,migrationCompleted=false;
const links=[
  {id:"home",label:"ホーム",href:"../../home.html"},
  {id:"attendance",label:"出勤",href:"../../employee_home.html"},
  {id:"learning",label:"学習",href:"../index.html"},
  {id:"wood",label:"木材",href:"../../wood/index.html"}
];

function status(id,message){$(id).textContent=message}
function serialize(value){
  if(value&&typeof value.toDate==="function")return {$type:"timestamp",seconds:value.seconds,nanoseconds:value.nanoseconds};
  if(value instanceof Date)return {$type:"date",value:value.toISOString()};
  if(Array.isArray(value))return value.map(serialize);
  if(value&&typeof value==="object"){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=serialize(value[key]);
    return out;
  }
  return value;
}
function stableStringify(value){return JSON.stringify(serialize(value))}
function downloadBackup(){
  if(!sourceData)return;
  const payload={
    format:"firestore-migration-backup-v1",
    sourceProject:"learning-info-site",
    createdAt:new Date().toISOString(),
    collections:Object.fromEntries(collections.map(name=>[
      name,sourceData[name].map(item=>({id:item.id,data:serialize(item.data)}))
    ]))
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download="learning-info-backup-"+new Date().toISOString().slice(0,10)+".json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  backupSaved=true;
  $("confirmMigration").checked=false;
  $("confirmMigration").disabled=false;
  $("migrateButton").disabled=true;
  status("migrationStatus","バックアップの保存を開始しました。保存先のJSONを開き、3コレクションの件数と内容を確認してからチェックを入れてください。");
}
$("connectButton").addEventListener("click",async()=>{
  const button=$("connectButton");
  button.disabled=true;
  status("connectionStatus","接続中...");
  try{
    await signInWithEmailAndPassword(sourceAuth,$("sourceEmail").value.trim(),$("sourcePassword").value);
    connected=true;
    $("sourcePassword").value="";
    $("previewButton").disabled=false;
    status("connectionStatus","旧システムに接続しました。");
  }catch(error){
    console.error(error);
    status("connectionStatus","接続できませんでした。メールアドレス・パスワードと旧Firebaseの認証状態を確認してください。");
  }finally{button.disabled=false}
});
$("previewButton").addEventListener("click",async()=>{
  const button=$("previewButton");
  button.disabled=true;
  $("backupButton").disabled=true;
  $("confirmMigration").checked=false;
  $("confirmMigration").disabled=true;
  $("migrateButton").disabled=true;
  backupSaved=false;
  sourceData=null;
  status("migrationStatus","旧データを読み込んでいます...");
  try{
    if(!connected||!sourceAuth.currentUser)throw new Error("source authentication missing");
    sourceData={};
    for(const name of collections){
      const snapshot=await getDocs(collection(sourceDb,name));
      sourceData[name]=snapshot.docs.map(item=>({id:item.id,data:item.data()}));
    }
    const total=collections.reduce((sum,name)=>sum+sourceData[name].length,0);
    const list=document.createElement("ul");
    for(const name of collections){
      const item=document.createElement("li");
      item.textContent=name+": "+sourceData[name].length+"件";
      list.append(item);
    }
    const totalItem=document.createElement("li");
    totalItem.textContent="合計: "+total+"件";
    list.append(totalItem);
    $("previewResult").replaceChildren(list);
    $("backupButton").disabled=false;
    status("migrationStatus","件数を確認しました。バックアップJSONを保存し、ファイルを開いて内容を確認してください。");
  }catch(error){
    console.error(error);
    status("migrationStatus","読み込みに失敗しました。旧システムの読み取り権限を確認してください。");
  }finally{button.disabled=false}
});
$("backupButton").addEventListener("click",downloadBackup);
$("confirmMigration").addEventListener("change",event=>{
  $("migrateButton").disabled=!(backupSaved&&event.target.checked&&!migrationBusy);
});

async function inspectDestination(){
  const missing=[];
  const identical=[];
  const conflicts=[];
  for(const name of collections){
    const sourceItems=sourceData[name];
    for(let offset=0;offset<sourceItems.length;offset+=20){
      const chunk=sourceItems.slice(offset,offset+20);
      const results=await Promise.all(chunk.map(async item=>({
        item,
        snapshot:await getDoc(doc(db,name,item.id))
      })));
      for(const {item,snapshot} of results){
        const key=name+"/"+item.id;
        if(!snapshot.exists())missing.push({collection:name,...item});
        else if(stableStringify(snapshot.data())===stableStringify(item.data))identical.push(key);
        else conflicts.push(key);
      }
    }
  }
  return {missing,identical,conflicts};
}
$("migrateButton").addEventListener("click",async()=>{
  if(migrationBusy||migrationCompleted||!backupSaved||!$("confirmMigration").checked||!sourceData)return;
  if(!confirm("統合先へのコピーを開始します。同じ内容のデータはコピー済みとして扱い、内容が異なる同一IDがあれば全体を中止します。続行しますか？"))return;
  migrationBusy=true;
  const button=$("migrateButton");
  button.disabled=true;
  $("previewButton").disabled=true;
  $("backupButton").disabled=true;
  status("migrationStatus","統合先の既存データを照合しています...");
  try{
    const {missing,identical,conflicts}=await inspectDestination();
    if(conflicts.length){
      throw new Error("同じIDで内容が異なるデータがあります。安全のためコピーを中止しました: "+conflicts.slice(0,10).join(", ")+(conflicts.length>10?" ほか":""));
    }
    if(missing.length===0){
      status("migrationStatus","コピー対象はありません。既存の"+identical.length+"件はすべて移行元と同じ内容です。");
    }else{
      for(let offset=0;offset<missing.length;offset+=400){
        const chunk=missing.slice(offset,offset+400);
        const batch=writeBatch(db);
        for(const item of chunk)batch.set(doc(db,item.collection,item.id),item.data);
        await batch.commit();
        status("migrationStatus","コピー中... "+Math.min(offset+chunk.length,missing.length)+" / "+missing.length+" 件（既存一致 "+identical.length+" 件はスキップ）");
      }
    }
    status("migrationStatus","書き込み後の内容を確認しています...");
    const verified=await inspectDestination();
    if(verified.conflicts.length||verified.missing.length){
      throw new Error("書き込み後の照合で未完了項目があります。再実行すると同一内容の移行済みデータをスキップして続行できます。");
    }
    status("migrationStatus","移行・照合完了：合計"+(identical.length+missing.length)+"件（今回コピー "+missing.length+"件、既存一致 "+identical.length+"件）。旧システムのデータは変更・削除していません。");
    await signOut(sourceAuth);
    connected=false;
    migrationCompleted=true;\n    status("connectionStatus","移行後、旧システムからログアウトしました。");
  }catch(error){
    console.error(error);
    status("migrationStatus","処理を停止しました："+error.message+"。途中まで書き込まれていても、同一内容のデータは次回スキップし、残りから続行できます。再実行前に件数とバックアップを再確認してください。");
  }finally{
    migrationBusy=false;
    button.disabled=migrationCompleted||!(backupSaved&&$("confirmMigration").checked);
    $("previewButton").disabled=!connected;
    $("backupButton").disabled=!sourceData;
  }
});
requireUser({
  loginUrl:"../../index.html",
  onReady:({profile})=>{
    if(profile?.isAdmin!==true){
      status("connectionStatus","この機能は管理者専用です。");
      $("connectButton").disabled=true;
      return;
    }
    mountAppShell({active:"learning",profile,links,homeHref:"../../home.html",logoutUrl:"../../index.html"});
    $("connectButton").disabled=false;
  },
  onError:()=>status("connectionStatus","統合先のユーザー情報を確認できませんでした。")
});
