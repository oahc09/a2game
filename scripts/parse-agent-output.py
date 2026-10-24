"""Reject duplicate object keys/non-finite numbers before normalizing a provider envelope."""
import json,sys
def unique(pairs):
 result={}
 for key,value in pairs:
  if key in result:raise ValueError('Duplicate JSON key: '+key)
  result[key]=value
 return result
try:
 text=json.load(sys.stdin)['text']
 value=json.loads(text,object_pairs_hook=unique,parse_constant=lambda value:(_ for _ in ()).throw(ValueError('Non-finite JSON constant')))
 normalized=json.dumps({'status':'PASS','output':value},ensure_ascii=False,allow_nan=False,separators=(',',':'))
 print(normalized)
except (ValueError,KeyError,RecursionError) as error:print(json.dumps({'status':'FAIL','message':str(error)[:400]}))
