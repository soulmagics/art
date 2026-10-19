<?php
declare(strict_types=1);

// Google OAuth Web client IDs are public identifiers, not client secrets.
const CIRCLE_GOOGLE_CLIENT_ID = '911041747158-7aja0937rklej4h5f9mgj0ei5ukpssrh.apps.googleusercontent.com';

function googleClientId(): string {
 global $cfg;
 return $cfg['google_client_id'] ?? CIRCLE_GOOGLE_CLIENT_ID;
}

function googleBase64(string $value): string|false {
 if(!preg_match('/^[A-Za-z0-9_-]+$/D',$value))return false;
 return base64_decode(strtr($value,'-_','+/').str_repeat('=',(4-strlen($value)%4)%4),true);
}

function googleCertificates(): array {
 global $configPath;
 $cache=dirname($configPath).'/google-certs.json';
 if(is_file($cache)){
  $saved=json_decode((string)file_get_contents($cache),true);
  if(is_array($saved)&&($saved['expires']??0)>time()&&is_array($saved['certs']??null))return $saved['certs'];
 }
 $url='https://www.googleapis.com/oauth2/v1/certs';
 if(function_exists('curl_init')){
  $handle=curl_init($url);
  curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>6,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HEADER=>true]);
  $response=curl_exec($handle);$code=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);$headerSize=curl_getinfo($handle,CURLINFO_HEADER_SIZE);
  if(!is_string($response)||$code!==200)throw new RuntimeException('Google 인증 서버에 연결하지 못했습니다.');
  $headers=substr($response,0,$headerSize);$body=substr($response,$headerSize);
 }else{
  $context=stream_context_create(['http'=>['timeout'=>6,'ignore_errors'=>true], 'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
  $body=@file_get_contents($url,false,$context);$headers=implode("\n",$http_response_header??[]);
  if(!is_string($body)||!preg_match('/^HTTP\/\S+ 200\b/',$headers))throw new RuntimeException('Google 인증 서버에 연결하지 못했습니다.');
 }
 $certs=json_decode($body,true);
 if(!is_array($certs)||!$certs)throw new RuntimeException('Google 인증 키를 확인하지 못했습니다.');
 foreach($certs as $kid=>$pem)if(!is_string($kid)||!is_string($pem)||openssl_x509_read($pem)===false)throw new RuntimeException('Google 인증 키 형식이 올바르지 않습니다.');
 $ttl=preg_match('/(?:^|[,\s])max-age=(\d+)/i',$headers,$match)?(int)$match[1]:300;
 $ttl=max(60,min(3600,$ttl));
 $encoded=json_encode(['expires'=>time()+$ttl,'certs'=>$certs],JSON_THROW_ON_ERROR);
 $oldMask=umask(0077);
 try{@file_put_contents($cache,$encoded,LOCK_EX);@chmod($cache,0600);}finally{umask($oldMask);}
 return $certs;
}

function verifyGoogleCredential(string $token,string $clientId,string $nonce,array $certs): array|false {
 if(strlen($token)>16384||strlen($token)<100)return false;
 $parts=explode('.',$token);if(count($parts)!==3)return false;
 [$head,$payload,$signature]=$parts;
 $headBytes=googleBase64($head);$payloadBytes=googleBase64($payload);$signatureBytes=googleBase64($signature);
 if($headBytes===false||$payloadBytes===false||$signatureBytes===false)return false;
 $header=json_decode($headBytes,true);$claims=json_decode($payloadBytes,true);
 if(!is_array($header)||!is_array($claims)||($header['alg']??'')!=='RS256')return false;
 $kid=$header['kid']??null;if(!is_string($kid)||!isset($certs[$kid])||!is_string($certs[$kid]))return false;
 if(openssl_verify($head.'.'.$payload,$signatureBytes,$certs[$kid],OPENSSL_ALGO_SHA256)!==1)return false;
 if(($claims['aud']??null)!==$clientId||!in_array($claims['iss']??null,['accounts.google.com','https://accounts.google.com'],true))return false;
 $now=time();if(!is_int($claims['exp']??null)||$claims['exp']<=$now||!is_int($claims['iat']??null)||$claims['iat']>$now+60)return false;
 if(!is_string($claims['nonce']??null)||!hash_equals($nonce,$claims['nonce']))return false;
 if(!is_string($claims['sub']??null)||$claims['sub']===''||strlen($claims['sub'])>255)return false;
 if(!is_string($claims['email']??null)||strlen($claims['email'])>320||!filter_var($claims['email'],FILTER_VALIDATE_EMAIL)||($claims['email_verified']??false)!==true)return false;
 return $claims;
}
