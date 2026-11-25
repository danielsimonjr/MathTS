import * as m from 'mathjs';
for (const c of [[[1e308,1e308,0]],[[1e9,1.5]],[[1e9,0]],[[20,20]]]) {
  try { console.log(JSON.stringify(c), m.format(m.multinomial(...c))); }
  catch(e){ console.log(JSON.stringify(c), 'throws', e.constructor.name, e.message); }
}
