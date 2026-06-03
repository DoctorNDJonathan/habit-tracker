import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';

const COLORS = ['#16A085','#2980B9','#8E44AD','#E67E22','#E74C3C','#27AE60','#F39C12','#2C3E50'];
const FREQUENCY_OPTIONS = [
  { value: 'daily',   label: 'Every day' },
  { value: 'weekly',  label: 'Once a week' },
  { value: 'monthly', label: 'Once a month' },
  { value: 'custom',  label: 'Custom interval' },
];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function isDueOnDate(habit, dateStr) {
  const date = new Date(dateStr);
  const start = new Date(habit.start_date);
  const end = habit.end_date ? new Date(habit.end_date) : null;
  date.setHours(0,0,0,0); start.setHours(0,0,0,0);
  if (date < start) return false;
  if (end && date > end) return false;
  const diffDays = Math.round((date - start) / 86400000);
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekly') return diffDays % 7 === 0;
  if (habit.frequency === 'monthly') return date.getDate() === start.getDate();
  if (habit.frequency === 'custom') return diffDays % (habit.frequency_days || 1) === 0;
  return false;
}

function getNextDue(habit) {
  if (!habit.last_logged_date) return { label: 'Not started', pending: true };
  const last = new Date(habit.last_logged_date);
  const gap = habit.frequency === 'daily' ? 1
    : habit.frequency === 'weekly' ? 7
    : habit.frequency === 'monthly' ? 30
    : habit.frequency_days || 1;
  const next = new Date(last);
  next.setDate(last.getDate() + gap);
  const today = new Date(); today.setHours(0,0,0,0); next.setHours(0,0,0,0);
  const diff = Math.round((next - today) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: 'Due today', due: true };
  return { label: `In ${diff}d`, ok: true };
}

function isDueToday(habit) {
  return isDueOnDate(habit, toDateStr(new Date()));
}

function isLoggedOnDate(habit, dateStr) {
  return habit.habit_logs?.some(l => l.logged_date === dateStr);
}

export default function App() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(null);
  const [breakReason, setBreakReason] = useState('');
  const [activeTab, setActiveTab] = useState('calendar');
  const [calDate, setCalDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [formData, setFormData] = useState({
    name: '', goal_days: 30, reminder_time: '09:00',
    color: COLORS[0], frequency: 'daily', frequency_days: 2,
    start_date: toDateStr(new Date())
  });
  const [session, setSession] = useState(null);
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  supabase.auth.onAuthStateChange((_event, session) => setSession(session));
}, []);

  useEffect(() => { fetchHabits(); }, []);

  async function fetchHabits() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('habits')
    .select('*, habit_logs(*), habit_breaks(*)')
    .eq('user_id', user.id);
    if (error) setError(error.message);
    else setHabits(data || []);
    setLoading(false);
  }

  async function createHabit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    const startDate = new Date(formData.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + parseInt(formData.goal_days));
    const { error } = await supabase.from('habits').insert({
      name: formData.name,
      goal_days: parseInt(formData.goal_days),
      reminder_time: formData.reminder_time,
      color: formData.color,
      frequency: formData.frequency,
      frequency_days: formData.frequency === 'custom' ? parseInt(formData.frequency_days) : null,
      start_date: formData.start_date,
      end_date: toDateStr(endDate),
      is_active: true
    });
    if (error) { alert('Error: ' + error.message); return; }
    setFormData({ name: '', goal_days: 30, reminder_time: '09:00', color: COLORS[0], frequency: 'daily', frequency_days: 2, start_date: toDateStr(new Date()) });
    setShowForm(false);
    fetchHabits();
  }

  async function logHabit(habitId, dateStr) {
    const date = dateStr || toDateStr(new Date());
    const { error } = await supabase.from('habit_logs')
      .insert({ habit_id: habitId, logged_date: date });
    if (error) { alert('Already logged or error: ' + error.message); return; }
    fetchHabits();
  }

  async function unlogHabit(habitId, dateStr) {
    await supabase.from('habit_logs')
      .delete().eq('habit_id', habitId).eq('logged_date', dateStr);
    fetchHabits();
  }

  async function logBreak(habit) {
    const today = toDateStr(new Date());
    const { error } = await supabase.from('habit_breaks')
      .insert({ habit_id: habit.id, break_date: today, reason: breakReason });
    if (error) { alert('Error: ' + error.message); return; }
    await supabase.from('habits').update({ current_streak: 0 }).eq('id', habit.id);
    setShowBreakModal(null); setBreakReason(''); fetchHabits();
  }

  async function deleteHabit(habitId) {
    if (!window.confirm('Delete this habit?')) return;
    await supabase.from('habits').delete().eq('id', habitId);
    fetchHabits();
  }

  const doneToday = habits.filter(h => isLoggedOnDate(h, toDateStr(new Date()))).length;
  const bestStreak = Math.max(0, ...habits.map(h => h.longest_streak || 0));
  if (!session) return <Auth />;
  if (loading) return <p style={s.loading}>Loading...</p>;
  if (error) return <p style={s.error}>Error: {error}</p>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>🔁 HabitLoop</h1>
        <div style={{display:'flex', gap:'8px'}}>
  <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
    {showForm ? '✕ Cancel' : '+ New Habit'}
  </button>
  <button style={{...s.addBtn, background:'#888'}}
    onClick={() => supabase.auth.signOut()}>
    Sign out
  </button>
</div>
      </div>

      {/* New Habit Form */}
      {showForm && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Create a new habit</h2>
          <form onSubmit={createHabit}>
            <div style={s.field}>
              <label style={s.label}>Habit name</label>
              <input style={s.input} type="text" placeholder="e.g. Morning meditation"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              <div style={s.field}>
                <label style={s.label}>Frequency</label>
                <select style={s.input} value={formData.frequency}
                  onChange={e => setFormData({...formData, frequency: e.target.value})}>
                  {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              {formData.frequency === 'custom' && (
                <div style={s.field}>
                  <label style={s.label}>Every X days</label>
                  <input style={s.input} type="number" min="2" max="365"
                    value={formData.frequency_days}
                    onChange={e => setFormData({...formData, frequency_days: e.target.value})} />
                </div>
              )}
              <div style={s.field}>
                <label style={s.label}>Goal duration</label>
                <select style={s.input} value={formData.goal_days}
                  onChange={e => setFormData({...formData, goal_days: e.target.value})}>
                  {[21,30,60,90,365].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              <div style={s.field}>
                <label style={s.label}>Start date</label>
                <input style={s.input} type="date" value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Reminder time</label>
                <input style={s.input} type="time" value={formData.reminder_time}
                  onChange={e => setFormData({...formData, reminder_time: e.target.value})} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Colour</label>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setFormData({...formData, color: c})}
                    style={{width:'28px', height:'28px', borderRadius:'50%', background:c, cursor:'pointer',
                      border: formData.color === c ? '3px solid #000' : '3px solid transparent'}} />
                ))}
              </div>
            </div>
            <button type="submit" style={s.submitBtn}>Create habit</button>
          </form>
        </div>
      )}

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.stat}><div style={s.statVal}>{doneToday}</div><div style={s.statLbl}>Done today</div></div>
        <div style={s.stat}><div style={s.statVal}>{habits.length}</div><div style={s.statLbl}>Total habits</div></div>
        <div style={s.stat}><div style={s.statVal}>🔥{bestStreak}</div><div style={s.statLbl}>Best streak</div></div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {['calendar','today','all','breaks'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{...s.tab, ...(activeTab === t ? s.tabActive : {})}}>
            {t === 'calendar' ? '📅 Calendar' : t === 'today' ? 'Due Today' : t === 'all' ? 'All Habits' : 'Breaks'}
          </button>
        ))}
      </div>

      {/* CALENDAR TAB */}
      {activeTab === 'calendar' && (
        <CalendarView
          habits={habits}
          calDate={calDate}
          setCalDate={setCalDate}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onLog={logHabit}
          onUnlog={unlogHabit}
        />
      )}

      {/* TODAY TAB */}
      {activeTab === 'today' && (
        <>
          {habits.filter(h => isDueToday(h) || isLoggedOnDate(h, toDateStr(new Date()))).length === 0
            && <div style={s.empty}>Nothing due today 🎉</div>}
          {habits.filter(h => isDueToday(h) || isLoggedOnDate(h, toDateStr(new Date()))).map(habit => (
            <HabitCard key={habit.id} habit={habit}
              logged={isLoggedOnDate(habit, toDateStr(new Date()))}
              due={getNextDue(habit)}
              pct={Math.min(100, Math.round((habit.habit_logs?.length||0)/habit.goal_days*100))}
              onLog={() => logHabit(habit.id)}
              onBreak={setShowBreakModal} onDelete={deleteHabit} />
          ))}
        </>
      )}

      {/* ALL HABITS TAB */}
      {activeTab === 'all' && (
        <>
          {habits.length === 0 && <div style={s.empty}>No habits yet. Click "+ New Habit" to start!</div>}
          {habits.map(habit => (
            <HabitCard key={habit.id} habit={habit}
              logged={isLoggedOnDate(habit, toDateStr(new Date()))}
              due={getNextDue(habit)}
              pct={Math.min(100, Math.round((habit.habit_logs?.length||0)/habit.goal_days*100))}
              onLog={() => logHabit(habit.id)}
              onBreak={setShowBreakModal} onDelete={deleteHabit} />
          ))}
        </>
      )}

      {/* BREAKS TAB */}
      {activeTab === 'breaks' && (
        <>
          {habits.every(h => !h.habit_breaks?.length)
            && <div style={s.empty}>No breaks logged yet. Keep it up! 💪</div>}
          {habits.filter(h => h.habit_breaks?.length > 0).map(habit => (
            <div key={habit.id} style={s.card}>
              <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px'}}>
                <div style={{width:'10px', height:'10px', borderRadius:'50%', background:habit.color}} />
                <span style={{fontWeight:'500'}}>{habit.name}</span>
                <span style={{fontSize:'12px', color:'#888', marginLeft:'auto'}}>
                  {habit.habit_breaks.length} break{habit.habit_breaks.length > 1 ? 's' : ''}
                </span>
              </div>
              {habit.habit_breaks.map(b => (
                <div key={b.id} style={s.breakRow}>
                  <span style={{fontSize:'13px', color:'#888', minWidth:'90px'}}>{b.break_date}</span>
                  <span style={{fontSize:'13px', flex:1}}>{b.reason || 'No reason given'}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Break Modal */}
      {showBreakModal && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h3 style={{marginTop:0, fontSize:'16px'}}>Log a break</h3>
            <p style={{fontSize:'13px', color:'#888', marginTop:0}}>
              Logging a break for <strong>{showBreakModal.name}</strong>. Your streak resets but progress is saved.
            </p>
            <textarea style={{...s.input, height:'80px', resize:'vertical'}}
              placeholder="Optional: why are you taking a break?"
              value={breakReason} onChange={e => setBreakReason(e.target.value)} />
            <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
              <button style={{...s.submitBtn, background:'#E74C3C', flex:1}}
                onClick={() => logBreak(showBreakModal)}>Log break</button>
              <button style={{...s.submitBtn, background:'#888', flex:1}}
                onClick={() => { setShowBreakModal(null); setBreakReason(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ habits, calDate, setCalDate, selectedDate, setSelectedDate, onLog, onUnlog }) {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateStr(new Date());

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedHabits = habits.filter(h => isDueOnDate(h, selectedDate));

  return (
    <div>
      {/* Month navigator */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
        <button style={s.navBtn} onClick={() => setCalDate(new Date(year, month - 1, 1))}>‹</button>
        <span style={{fontWeight:'500', fontSize:'15px'}}>{MONTHS[month]} {year}</span>
        <button style={s.navBtn} onClick={() => setCalDate(new Date(year, month + 1, 1))}>›</button>
      </div>

      {/* Day headers */}
      <div style={s.calGrid}>
        {DAYS.map(d => (
          <div key={d} style={s.calDayHeader}>{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={s.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <div key={'e'+i} />;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dueHabits = habits.filter(h => isDueOnDate(h, dateStr));
          const loggedHabits = habits.filter(h => isLoggedOnDate(h, dateStr));
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const allDone = dueHabits.length > 0 && loggedHabits.length >= dueHabits.length;
          const someDone = loggedHabits.length > 0 && !allDone;

          return (
            <div key={dateStr} onClick={() => setSelectedDate(dateStr)}
              style={{
                ...s.calCell,
                background: isSelected ? '#16A085' : isToday ? '#e8f5f1' : '#fff',
                color: isSelected ? '#fff' : '#000',
                border: isToday && !isSelected ? '2px solid #16A085' : '1px solid #eee',
                cursor: 'pointer'
              }}>
              <span style={{fontSize:'13px', fontWeight: isToday ? '600' : '400'}}>{day}</span>
              {/* Habit dots */}
              <div style={{display:'flex', gap:'2px', flexWrap:'wrap', marginTop:'3px', justifyContent:'center'}}>
                {dueHabits.slice(0,4).map(h => {
                  const logged = isLoggedOnDate(h, dateStr);
                  return (
                    <div key={h.id} style={{
                      width:'6px', height:'6px', borderRadius:'50%',
                      background: logged ? h.color : isSelected ? 'rgba(255,255,255,0.4)' : '#ddd'
                    }} />
                  );
                })}
              </div>
              {/* Completion indicator */}
              {allDone && <div style={{fontSize:'9px', marginTop:'1px', color: isSelected ? '#fff' : '#16A085'}}>✓</div>}
              {someDone && !allDone && <div style={{fontSize:'9px', marginTop:'1px', color: isSelected ? '#fff' : '#E67E22'}}>~</div>}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:'flex', gap:'16px', fontSize:'11px', color:'#888', margin:'10px 0', flexWrap:'wrap'}}>
        <span><span style={{color:'#16A085'}}>●</span> Logged</span>
        <span><span style={{color:'#ddd'}}>●</span> Due but not logged</span>
        <span><span style={{color:'#16A085'}}>✓</span> All done</span>
        <span><span style={{color:'#E67E22'}}>~</span> Partially done</span>
      </div>

      {/* Selected date detail */}
      <div style={{...s.card, marginTop:'4px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px'}}>
          <span style={{fontWeight:'500', fontSize:'14px'}}>
            {selectedDate === today ? 'Today' : selectedDate}
          </span>
          <span style={{fontSize:'12px', color:'#888'}}>
            {selectedHabits.length} habit{selectedHabits.length !== 1 ? 's' : ''} scheduled
          </span>
        </div>

        {selectedHabits.length === 0 && (
          <div style={{fontSize:'13px', color:'#aaa', textAlign:'center', padding:'1rem'}}>
            No habits scheduled for this day
          </div>
        )}

        {selectedHabits.map(habit => {
          const logged = isLoggedOnDate(habit, selectedDate);
          const isFuture = selectedDate > today;
          return (
            <div key={habit.id} style={{display:'flex', alignItems:'center', gap:'10px',
              padding:'8px 0', borderTop:'1px solid #f5f5f5'}}>
              <div style={{width:'10px', height:'10px', borderRadius:'50%', background:habit.color, flexShrink:0}} />
              <span style={{flex:1, fontSize:'14px'}}>{habit.name}</span>
              <span style={{fontSize:'11px', color:'#aaa'}}>⏰{habit.reminder_time}</span>
              {!isFuture && (
                <button
                  onClick={() => logged ? onUnlog(habit.id, selectedDate) : onLog(habit.id, selectedDate)}
                  style={{
                    ...s.checkBtn,
                    width:'28px', height:'28px', fontSize:'13px',
                    background: logged ? habit.color : 'transparent',
                    color: logged ? '#fff' : '#aaa',
                    borderColor: logged ? habit.color : '#ccc'
                  }}>
                  {logged ? '✓' : '○'}
                </button>
              )}
              {isFuture && <span style={{fontSize:'11px', color:'#aaa'}}>upcoming</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HabitCard({ habit, logged, due, pct, onLog, onBreak, onDelete }) {
  const freqLabel = habit.frequency === 'daily' ? 'Daily'
    : habit.frequency === 'weekly' ? 'Weekly'
    : habit.frequency === 'monthly' ? 'Monthly'
    : `Every ${habit.frequency_days}d`;
  return (
    <div style={{...s.card, opacity: logged ? 0.75 : 1}}>
      <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
        <div style={{width:'12px', height:'12px', borderRadius:'50%', background:habit.color, flexShrink:0}} />
        <div style={{flex:1}}>
          <div style={{fontSize:'15px', fontWeight:'500'}}>{habit.name}</div>
          <div style={{fontSize:'12px', color:'#888', marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap'}}>
            <span>⏰ {habit.reminder_time}</span>
            <span>🔁 {freqLabel}</span>
            <span>🔥 {habit.current_streak || 0}</span>
            <span style={{color: due.overdue?'#E74C3C': due.due?'#E67E22':'#27AE60', fontWeight:'500'}}>
              ● {due.label}
            </span>
          </div>
        </div>
        <button onClick={onLog} style={{...s.checkBtn,
          background: logged ? habit.color : 'transparent',
          color: logged ? '#fff' : '#aaa',
          borderColor: logged ? habit.color : '#ccc'}}>
          {logged ? '✓' : '○'}
        </button>
        <button onClick={() => onBreak(habit)} style={s.breakBtn}>⏸</button>
        <button onClick={() => onDelete(habit.id)} style={s.deleteBtn}>🗑</button>
      </div>
      <div style={s.progressBg}>
        <div style={{...s.progressFill, width:pct+'%', background:habit.color}} />
      </div>
      <div style={{fontSize:'11px', color:'#aaa', marginTop:'4px', display:'flex', justifyContent:'space-between'}}>
        <span>{habit.start_date} → {habit.end_date}</span>
        <span>{pct}% · Best 🔥{habit.longest_streak||0}</span>
      </div>
    </div>
  );
}

const s = {
  page:{maxWidth:'640px',margin:'0 auto',padding:'2rem 1rem',fontFamily:'system-ui, sans-serif'},
  header:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'},
  title:{fontSize:'22px',fontWeight:'600',margin:0},
  addBtn:{padding:'8px 16px',background:'#16A085',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'14px',fontWeight:'500'},
  card:{background:'#fff',border:'1px solid #eee',borderRadius:'12px',padding:'1rem 1.1rem',marginBottom:'10px'},
  sectionTitle:{fontSize:'16px',fontWeight:'500',marginTop:0,marginBottom:'1rem'},
  field:{marginBottom:'1rem'},
  label:{display:'block',fontSize:'13px',color:'#666',marginBottom:'5px',fontWeight:'500'},
  input:{width:'100%',padding:'8px 10px',fontSize:'14px',border:'1px solid #ddd',borderRadius:'8px',boxSizing:'border-box'},
  submitBtn:{width:'100%',padding:'10px',background:'#16A085',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer',marginTop:'4px'},
  statsRow:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'1.25rem'},
  stat:{background:'#f8f8f8',padding:'12px',borderRadius:'8px',textAlign:'center'},
  statVal:{fontSize:'22px',fontWeight:'500'},
  statLbl:{fontSize:'12px',color:'#888',marginTop:'2px'},
  tabs:{display:'flex',gap:'4px',background:'#f5f5f5',padding:'4px',borderRadius:'8px',marginBottom:'1rem'},
  tab:{flex:1,padding:'7px',border:'none',background:'transparent',borderRadius:'6px',cursor:'pointer',fontSize:'13px',color:'#888'},
  tabActive:{background:'#fff',color:'#000',fontWeight:'500',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'},
  empty:{textAlign:'center',padding:'3rem 1rem',color:'#aaa',fontSize:'14px'},
  checkBtn:{width:'34px',height:'34px',borderRadius:'50%',border:'1.5px solid #ccc',cursor:'pointer',fontSize:'16px',flexShrink:0},
  breakBtn:{background:'none',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer',fontSize:'14px',padding:'4px 8px'},
  deleteBtn:{background:'none',border:'none',cursor:'pointer',fontSize:'16px',padding:'4px'},
  progressBg:{height:'4px',background:'#f0f0f0',borderRadius:'2px',marginTop:'10px'},
  progressFill:{height:'100%',borderRadius:'2px',transition:'width 0.4s'},
  breakRow:{display:'flex',alignItems:'center',padding:'6px 0',borderTop:'1px solid #f5f5f5'},
  modalOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999},
  modal:{background:'#fff',borderRadius:'12px',padding:'1.5rem',width:'90%',maxWidth:'400px'},
  calGrid:{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'4px'},
  calDayHeader:{textAlign:'center',fontSize:'11px',color:'#aaa',fontWeight:'500',padding:'4px 0'},
  calCell:{borderRadius:'8px',padding:'6px 4px',textAlign:'center',minHeight:'52px',display:'flex',flexDirection:'column',alignItems:'center'},
  navBtn:{background:'none',border:'1px solid #eee',borderRadius:'6px',padding:'4px 12px',cursor:'pointer',fontSize:'16px'},
  loading:{padding:'2rem',fontFamily:'sans-serif'},
  error:{padding:'2rem',color:'red',fontFamily:'sans-serif'},
};