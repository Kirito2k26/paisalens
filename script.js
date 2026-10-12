'use strict';
const $ = id => document.getElementById(id);
const KEY = 'pocketwise-v1';
const groups = {expense:['Food & groceries','Transport','Shopping','Bills & utilities','Entertainment','Health','Education','Other'],income:['Salary','Freelance','Gift','Other income']};
const money = cents => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(cents/100);
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const validDate = s => {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=1900;};
const validMonth = s => typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s)&&Number(s.slice(0,4))>=1900;
function validate(data){if(!data||data.version!==1||!Array.isArray(data.transactions)||data.transactions.length>50000||!data.budgets||typeof data.budgets!=='object'||Array.isArray(data.budgets))throw Error('Invalid backup format.');const ids=new Set();for(const t of data.transactions){if(!t||typeof t.id!=='string'||!t.id||ids.has(t.id)||!groups[t.type]?.includes(t.category)||typeof t.description!=='string'||!t.description.trim()||t.description.length>120||!Number.isSafeInteger(t.amount)||t.amount<=0||t.amount>100000000000||!validDate(t.date))throw Error('Invalid transaction in backup.');ids.add(t.id);}for(const [m,b] of Object.entries(data.budgets)){if(!validMonth(m)||!Number.isSafeInteger(b)||b<0||b>100000000000)throw Error('Invalid budget in backup.');}return {version:1,transactions:data.transactions.map(t=>({id:t.id,type:t.type,amount:t.amount,description:t.description,category:t.category,date:t.date})),budgets:{...data.budgets}};}
let state={version:1,transactions:[],budgets:{}};
function notify(text){$('notice').textContent=text;}
try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw));}catch(e){notify('Saved data could not be loaded. Export a backup before making changes, or restore a valid backup.');}
function commit(next){try{localStorage.setItem(KEY,JSON.stringify(next));state=next;return true;}catch(e){notify('Unable to save in this browser. Your change was not saved. Free up storage or enable browser storage.');return false;}}
function options(el,values,all=false){el.replaceChildren();if(all)el.add(new Option('All categories','all'));values.forEach(v=>el.add(new Option(v,v)));}
function reset(){ $('transaction-form').reset();$('edit-id').value='';$('date').value=today();options($('category'),groups.expense);$('form-title').textContent='Add a transaction';$('save').textContent='+ Add transaction';$('cancel').hidden=true;}
function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function filtered(){return state.transactions.filter(t=>t.date.slice(0,7)===$('month').value&&($('filter-type').value==='all'||t.type===$('filter-type').value)&&($('filter-category').value==='all'||t.category===$('filter-category').value)&&`${t.description} ${t.amount/100}`.toLowerCase().includes($('search').value.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));}
function render(){const month=$('month').value;if(!validMonth(month))return;const tx=state.transactions.filter(t=>t.date.startsWith(month));const expenses=tx.filter(t=>t.type==='expense');const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);const spent=expenses.reduce((s,t)=>s+t.amount,0);$('income').textContent=money(income);$('expense').textContent=money(spent);$('balance').textContent=money(income-spent);const budget=state.budgets[month]||0;$('budget').value=budget?budget/100:'';const ratio=budget?spent/budget:0;$('budget-status').textContent=budget?`${money(spent)} of ${money(budget)}`:'No budget set';$('budget-percent').textContent=budget?`${Math.round(ratio*100)}% used`:'';$('budget-bar').style.width=`${Math.min(100,ratio*100)}%`;$('budget-bar').style.background=ratio>=1?'var(--red)':ratio>=.8?'#ffcf7b':'var(--green)';$('budget-detail').textContent=budget?(spent>budget?`${money(spent-budget)} over budget.`:`${money(budget-spent)} left to spend.`):'Set a budget above. Enter 0 to remove it.';
const totals=groups.expense.map(c=>({c,amount:expenses.filter(t=>t.category===c).reduce((s,t)=>s+t.amount,0)})).filter(t=>t.amount).sort((a,b)=>b.amount-a.amount);$('categories').replaceChildren();if(!totals.length){const p=document.createElement('p');p.className='muted';p.textContent='Add your first expense to see your spending breakdown.';$('categories').append(p);}totals.forEach(t=>{const row=document.createElement('div');row.className='cat-row';const label=document.createElement('div');label.className='cat-label';const name=document.createElement('span');name.textContent=t.c;const value=document.createElement('span');value.textContent=`${money(t.amount)} · ${Math.round(t.amount/spent*100)}%`;label.append(name,value);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='cat-fill';fill.style.width=`${t.amount/spent*100}%`;track.append(fill);row.append(label,track);$('categories').append(row);});
$('insight').textContent=!expenses.length?'Your first expense is the start of a clearer picture. Add it to discover your biggest spending category.':budget&&ratio>=1?'You have reached your monthly budget. Review your largest category before your next purchase.':budget&&ratio>=.8?'You have used at least 80% of your budget. Keep an eye on the remaining amount.':`${totals[0].c} is your largest spending category at ${Math.round(totals[0].amount/spent*100)}% of expenses. Review those purchases for potential savings.`;
renderMonthSummary(month,income,spent,budget);
renderInsights(month,expenses,income,spent,budget,totals);
const [year,mo]=month.split('-').map(Number);const days=new Date(year,mo,0).getDate();const amounts=Array.from({length:days},(_,i)=>expenses.filter(t=>Number(t.date.slice(8))===i+1).reduce((s,t)=>s+t.amount,0));const max=Math.max(1,...amounts);$('daily').replaceChildren();amounts.forEach((v,i)=>{const bar=document.createElement('div');bar.className='day';bar.style.height=`${Math.max(1,v/max*100)}%`;bar.tabIndex=0;bar.title=`${month}-${String(i+1).padStart(2,'0')}: ${money(v)}`;bar.setAttribute('aria-label',bar.title);$('daily').append(bar);});
$('rows').replaceChildren();const visible=filtered();visible.forEach(t=>{const tr=document.createElement('tr');[t.date,t.description,t.category,`${t.type==='income'?'+':'−'}${money(t.amount)}`].forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;if(i===3)td.className=t.type==='income'?'positive':'negative';tr.append(td);});const actions=document.createElement('td');for(const [action,text] of [['edit','Edit'],['delete','Delete']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.action=action;b.dataset.id=t.id;b.setAttribute('aria-label',`${text} ${t.description}`);actions.append(b);}tr.append(actions);$('rows').append(tr);});if(!visible.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='No transactions found for this month and filters.';tr.append(td);$('rows').append(tr);}$('count').textContent=`${visible.length} transaction${visible.length===1?'':'s'} shown`;
}
$('month').value=today().slice(0,7);reset();options($('filter-category'),[...groups.expense,...groups.income],true);render();
$('type').addEventListener('change',()=>options($('category'),groups[$('type').value]));
$('transaction-form').addEventListener('submit',e=>{e.preventDefault();const amount=Math.round(Number($('amount').value)*100);const description=$('description').value.trim();const date=$('date').value;if(!description||!validDate(date)||!Number.isSafeInteger(amount)||amount<=0||amount>100000000000){notify('Enter a valid description, date, and amount.');return;}const id=$('edit-id').value||globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;const t={id,type:$('type').value,amount,description,category:$('category').value,date};const next={...state,transactions:[...state.transactions.filter(x=>x.id!==id),t]};if(commit(next)){$('month').value=date.slice(0,7);reset();render();notify('Transaction saved.');}});
$('cancel').addEventListener('click',reset);
$('budget-form').addEventListener('submit',e=>{e.preventDefault();const b=Math.round(Number($('budget').value)*100);if(!validMonth($('month').value)||!Number.isSafeInteger(b)||b<0||b>100000000000)return;if(commit({...state,budgets:{...state.budgets,[$('month').value]:b}})){render();notify(b?'Monthly budget saved.':'Monthly budget removed.');}});
for(const id of ['month','search','filter-type','filter-category'])$(id).addEventListener('input',render);
$('rows').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const t=state.transactions.find(x=>x.id===b.dataset.id);if(!t)return;if(b.dataset.action==='delete'){if(!confirm(`Delete "${t.description}" (${money(t.amount)})?`))return;if(commit({...state,transactions:state.transactions.filter(x=>x.id!==t.id)})){if($('edit-id').value===t.id)reset();render();notify('Transaction deleted.');}}else{$('edit-id').value=t.id;$('type').value=t.type;options($('category'),groups[t.type]);$('category').value=t.category;$('amount').value=t.amount/100;$('description').value=t.description;$('date').value=t.date;$('form-title').textContent='Edit transaction';$('save').textContent='Save changes';$('cancel').hidden=false;$('transaction-form').scrollIntoView({behavior:'smooth',block:'center'});$('description').focus({preventScroll:true});}});
$('export').addEventListener('click',()=>download(JSON.stringify(state,null,2),`paisalens-backup-${today()}.json`,'application/json'));
$('import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>20*1024*1024){notify('Backup is too large. Maximum size is 20 MB.');return;}try{const next=validate(JSON.parse(await f.text()));if(!confirm(`Restore ${next.transactions.length} transactions? This replaces all current records and budgets. Download a backup first if you need to keep them.`))return;if(commit(next)){reset();render();notify('Backup restored.');}}catch(err){notify('Could not restore this file. Choose a valid PaisaLens JSON backup.');}});
$('csv').addEventListener('click',()=>{const escape=v=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const rows=[['Date','Description','Type','Category','Amount (INR)'],...filtered().map(t=>[t.date,t.description,t.type,t.category,(t.amount/100).toFixed(2)])];download('\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n'),`paisalens-${$('month').value}.csv`,'text/csv;charset=utf-8');});
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{state=e.newValue?validate(JSON.parse(e.newValue)):{version:1,transactions:[],budgets:{}};reset();render();notify('Records updated from another tab.');}catch(err){notify('Another tab saved invalid records. Refresh or restore your backup.');}});

// Show the storage notice before the dashboard on every visit.
const storageDialog = $('storage-disclaimer');
$('accept-disclaimer').addEventListener('click',()=>storageDialog.close());
$('storage-help').addEventListener('click',()=>storageDialog.showModal());
storageDialog.addEventListener('cancel',e=>e.preventDefault());
storageDialog.showModal();

function getInsightCards(month, expenses, income, spent, budget, totals, transactions, currentDate = today()) {
  const [year, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mo, 0).getDate();
  const currentMonth = currentDate.slice(0, 7);
  const isCurrent = month === currentMonth;
  const isFuture = month > currentMonth;
  const elapsed = isCurrent ? Number(currentDate.slice(8)) : daysInMonth;
  const prevDate = new Date(year, mo - 2, 1);
  const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
  const previousDays = new Date(year, mo - 1, 0).getDate();
  const cutoff = isCurrent ? Math.min(elapsed, previousDays) : previousDays;
  const previous = transactions.filter(t => t.type === 'expense' && t.date.startsWith(previousMonth) && Number(t.date.slice(8)) <= cutoff);
  const previousTotal = previous.reduce((sum,t) => sum + t.amount, 0);
  const cards = [];
  if (!expenses.length) {
    cards.push({title:'Start with one expense',value:'Your picture starts here',detail:'Add expenses to see category shares, daily averages, and changes over time.'});
  } else {
    cards.push({title:'Largest spending category',value:totals[0].c,detail:`${money(totals[0].amount)} · ${Math.round(totals[0].amount / spent * 100)}% of recorded expenses this month.`});
    cards.push({title:isFuture?'Average per calendar day':'Average daily spending',value:money(Math.round(spent / elapsed)),detail:isCurrent?`Recorded expenses divided by ${elapsed} calendar days so far, including today.`:`Recorded expenses divided by all ${daysInMonth} calendar days in the selected month.`});
    const biggest = expenses.reduce((a,b)=>a.amount>=b.amount?a:b);
    cards.push({title:'Largest single expense',value:money(biggest.amount),detail:`${biggest.description} · ${biggest.date}`});
  }
  if (isFuture) {
    cards.push({title:'Previous-month comparison',value:'Future month selected',detail:'Choose the current or an earlier month to compare recorded spending.'});
  } else if (!previous.length) {
    cards.push({title:'Previous-month comparison',value:'No comparison yet',detail:`No expenses recorded for ${previousMonth}${isCurrent?` through day ${cutoff}`:''}. This does not establish that spending was zero.`});
  } else {
    const change = spent - previousTotal;
    const percentage = Math.round(Math.abs(change) / previousTotal * 100);
    cards.push({title:'Previous-month comparison',value:change===0?'Same recorded total':`${percentage}% ${change>0?'higher':'lower'}`,detail:`${money(Math.abs(change))} ${change>=0?'more':'less'} than ${previousMonth} (${money(previousTotal)}). ${isCurrent?`Compares this month through day ${elapsed} with the previous month through day ${cutoff}.`:'Compares full calendar months.'} Incomplete logging can affect this comparison.`});
  }
  const remaining = budget - spent;
  cards.push(!budget?{title:'Budget progress',value:'Set a spending limit',detail:'Add a monthly budget to see remaining funds and spending-limit warnings.'}:remaining<0?{title:'Budget exceeded',value:money(-remaining),detail:`Above your ${money(budget)} monthly spending limit. Review recorded expenses before changing your budget.`}:{title:'Budget remaining',value:money(remaining),detail:`${Math.round(spent/budget*100)}% of your ${money(budget)} limit is used.`});
  if (budget && isCurrent && remaining >= 0) {
    const daysLeft = daysInMonth - elapsed + 1;
    cards.push({title:'Remaining budget per day',value:money(Math.floor(remaining / daysLeft)),detail:`Your remaining budget divided across ${daysLeft} days, including today. This is a planning guide, not a forecast.`});
  } else {
    cards.push({title:'Income minus expenses',value:money(income-spent),detail:income?'Difference between recorded income and expenses for this month. It excludes any opening balance.':'No income recorded this month. Add income for a more complete monthly picture.'});
  }
  return cards;
}
function renderInsights(month, expenses, income, spent, budget, totals) {
  $('insight-cards').replaceChildren();
  for (const card of getInsightCards(month,expenses,income,spent,budget,totals,state.transactions)) {
    const box = document.createElement('article');
    box.className = 'insight-card';
    const title = document.createElement('h3');title.textContent = card.title;
    const value = document.createElement('div');value.className = 'insight-value';value.textContent = card.value;
    const detail = document.createElement('p');detail.textContent = card.detail;
    box.append(title,value,detail);$('insight-cards').append(box);
  }
}

function monthSummaryValues(month,income,spent,budget,currentMonth=today().slice(0,7)) {
  return {completed:month<currentMonth,future:month>currentMonth,hasBudget:budget>0,hasIncome:income>0,budgetDifference:budget-spent,incomeDifference:income-spent};
}
function renderMonthSummary(month,income,spent,budget) {
  const result=monthSummaryValues(month,income,spent,budget);
  $('summary-period').textContent=month;
  $('summary-title').textContent=result.completed?'Month-end summary':result.future?'Planned month summary':'This month so far';
  $('summary-note').textContent=result.completed?'This month has ended. Here is what remained from your recorded budget and income.':result.future?'This month has not started. Figures reflect any entries already recorded for it.':'These figures change as you add transactions. The final month-end result appears after the month ends.';
  $('summary-budget-label').textContent=!result.hasBudget?'Unused budget':result.budgetDifference<0?'Over budget':result.completed?'Unused budget':'Budget remaining';
  $('summary-budget-value').textContent=result.hasBudget?money(Math.abs(result.budgetDifference)):'No budget set';
  $('summary-budget-value').className='insight-value'+(result.hasBudget&&result.budgetDifference<0?' negative':'');
  $('summary-budget-detail').textContent=result.hasBudget?`${money(budget)} budget − ${money(spent)} expenses${result.budgetDifference<0?'. Expenses exceeded the budget.':'.'}`:'Set a monthly budget to calculate the unused amount.';
  $('summary-income-label').textContent=result.incomeDifference<0?'Income shortfall':'Income left after expenses';
  $('summary-income-value').textContent=money(Math.abs(result.incomeDifference));
  $('summary-income-value').className='insight-value'+(result.incomeDifference<0?' negative':'');
  $('summary-income-detail').textContent=`${money(income)} recorded income − ${money(spent)} expenses. ${!result.hasIncome?'No income recorded; add any missing income.':result.incomeDifference<0?'Expenses exceeded recorded income.':'This is a recorded surplus, not a confirmed bank or savings-account balance.'}`;
}
