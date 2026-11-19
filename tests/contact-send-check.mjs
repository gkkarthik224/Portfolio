import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
class Node {
  attributes=new Map(); events=new Map(); value=''; disabled=true; hidden=false; validity='';
  setAttribute(key,value){this.attributes.set(key,value)}
  removeAttribute(key){this.attributes.delete(key)}
  addEventListener(event,callback){this.events.set(event,callback)}
  setCustomValidity(message){this.validity=message}
  reportValidity(){this.reported=true;return !this.validity}
  querySelector(selector){return this.children?.[selector]}
  querySelectorAll(){return this.nodes||[]}
  focus(){this.focused=true}
}
const name=new Node(), email=new Node(), details=new Node(), submit=new Node(), caption=new Node();
submit.children={p:caption};
const main=new Node();main.children={'[name="Name"]':name,'[name="Email"]':email,'[name="Details"]':details,'[type="submit"]':submit};
const demo=new Node(), demoSubmit=new Node(), reply=new Node(), project=new Node();
demo.children={'[type="submit"]':demoSubmit};
project.selectedOptions=[{textContent:'Smart Procurement ERP Logging System'}];
const generalTab=new Node(), demoTab=new Node(), generalPanel=new Node(), demoPanel=new Node();
generalTab.setAttribute('aria-controls','general');demoTab.setAttribute('aria-controls','demo');
generalTab.getAttribute=key=>generalTab.attributes.get(key);demoTab.getAttribute=key=>demoTab.attributes.get(key);
const tabList=new Node();tabList.nodes=[generalTab,demoTab];
const ids={'contact-demo-form':demo,'contact-demo-project':project,'contact-demo-reply':reply,general:generalPanel,demo:demoPanel};
const opened=[];
const context={location:{assign:url=>opened.push(new URL(url))},window:{addEventListener(){}},MutationObserver:class{observe(){}},document:{documentElement:{hasAttribute(){return true}},querySelector:selector=>selector==='.contact-tabs'?tabList:null,querySelectorAll:()=>[main,demo],getElementById:id=>ids[id]}};
vm.runInNewContext(await readFile(new URL('../src/scripts/contact/email-draft.js',import.meta.url),'utf8'),context);
assert.equal(caption.textContent,'Send');assert.equal(submit.attributes.get('aria-label'),'Send');assert.equal(submit.disabled,false);assert.equal(demoSubmit.disabled,false);
const event={preventDefault(){},stopImmediatePropagation(){}};
name.value='   ';email.value='visitor@example.com';details.value='Hello';main.events.get('submit')(event);assert.equal(opened.length,0);assert.ok(name.validity);
name.events.get('input')();name.value='  Test Visitor  ';details.value='R&D project\nSecond line';main.events.get('submit')(event);
assert.equal(opened.length,1);assert.equal(opened[0].pathname,'gkrishankarthik2004@gmail.com');assert.equal(opened[0].searchParams.get('subject'),'Portfolio enquiry from Test Visitor');assert.equal(opened[0].searchParams.get('body'),'Name: Test Visitor\nReply email: visitor@example.com\n\nR&D project\nSecond line');
reply.value='invalid';demo.events.get('submit')(event);assert.equal(opened.length,1);assert.ok(reply.validity);
reply.events.get('input')();reply.value='visitor@example.com';demo.events.get('submit')(event);assert.equal(opened.length,2);assert.equal(opened[1].searchParams.get('subject'),'Demo request: Smart Procurement ERP Logging System');assert.ok(opened[1].searchParams.get('body').includes('My email: visitor@example.com'));
reply.value='+91 98765 43210';demo.events.get('submit')(event);assert.equal(opened.length,3);assert.ok(opened[2].searchParams.get('body').includes('My phone number: +91 98765 43210'));
demoTab.events.get('click')();assert.equal(generalPanel.hidden,true);assert.equal(demoPanel.hidden,false);
console.log('Passed: Send labels, one-step email launch, enquiry payload, demo email/phone payloads, validation, and tab switching. No emails sent.');
