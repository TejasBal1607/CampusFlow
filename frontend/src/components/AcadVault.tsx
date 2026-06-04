import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, X, Search, Plus, ChevronDown, ChevronRight, FileText, Loader2,
  UploadCloud, Link as LinkIcon, FileUp, ExternalLink, Clock, Trash2,
} from 'lucide-react';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

const THAPAR_STREAMS = [
  'COE', 'COBS', 'COPC', 'DSAI', 'RAI', 'ENC', 'EEC', 'ELE', 'ECE',
  'MEE', 'MEC', 'EVD', 'EIC', 'CCA', 'CIE', 'CHE', 'BME', 'BT',
];

const SUB_TAGS = ['PYQ', 'Notes', 'Cheatsheet', 'Syllabus', 'Other'] as const;

type Kind = 'YEAR1_COMMON' | 'STREAM_SCHEME' | 'STREAM_COURSE' | 'MISC';

interface Resource {
  id: number;
  title: string;
  file_url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploader_id: number;
  uploader_name?: string | null;
  created_at?: string | null;
  kind: Kind | null;
  year: number | null;
  stream: string | null;
  course_code: string | null;
  course_name: string | null;
  sub_tag: string | null;
  source: 'file' | 'link' | null;
}

interface Course { code: string; name: string }

interface Props {
  onClose: () => void;
  isGuest: boolean;
  userStream?: string;
  currentUserId?: string | number;
}

export default function AcadVault({ onClose, isGuest, userStream, currentUserId }: Props) {
  const token = localStorage.getItem('cf_token');

  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ yr1: true, streams: true });

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const fetchResources = async () => {
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await axios.get(`${API_HOST}/acad/resources?token=${token}`);
      setResources(res.data || []);
    } catch (e) {
      console.error('Failed to load resources', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchResources(); }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this resource?')) return;
    try {
      await axios.delete(`${API_HOST}/acad/resources/${id}?token=${token}`);
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Delete failed');
    }
  };

  // ===== Filter + group =====
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(r =>
      [r.title, r.course_code, r.course_name, r.stream, r.sub_tag, r.uploader_name]
        .some(v => (v || '').toString().toLowerCase().includes(q))
    );
  }, [resources, search]);

  const grouped = useMemo(() => {
    const y1: Record<string, Resource[]> = {};
    const streams: Record<string, { scheme: Resource[]; years: Record<number, Record<string, Resource[]>> }> = {};
    const misc: Resource[] = [];

    for (const r of filtered) {
      if (r.kind === 'YEAR1_COMMON') {
        const k = r.course_code || 'UNCATEGORIZED';
        (y1[k] = y1[k] || []).push(r);
      } else if (r.kind === 'STREAM_SCHEME' && r.stream) {
        const s = (streams[r.stream] = streams[r.stream] || { scheme: [], years: {} });
        s.scheme.push(r);
      } else if (r.kind === 'STREAM_COURSE' && r.stream && r.year) {
        const s = (streams[r.stream] = streams[r.stream] || { scheme: [], years: {} });
        const y = (s.years[r.year] = s.years[r.year] || {});
        const k = r.course_code || 'UNCATEGORIZED';
        (y[k] = y[k] || []).push(r);
      } else {
        misc.push(r);
      }
    }
    return { y1, streams, misc };
  }, [filtered]);

  const courseName = (code: string, list: Resource[]) =>
    list.find(r => r.course_name)?.course_name || code;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150]" />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t-2 border-slate-700 rounded-t-3xl z-[160] flex flex-col max-h-[85vh] h-[85vh]"
      >
        <div className="p-5 border-b-2 border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black tracking-widest uppercase flex items-center gap-2">
            <FolderOpen className="text-blue-500" /> Acad Vault
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 hide-scrollbar bg-slate-950/50">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-500" size={20} />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search files, tags, codes..."
                className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 font-sans font-bold focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-sans">
              <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">No resources yet.</p>
              <p className="text-xs mt-1">Be the first to upload — file or link.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 font-sans space-y-1">
              {/* YEAR 1 COMMON */}
              {Object.keys(grouped.y1).length > 0 && (
                <FolderNode id="yr1" label="Year 1 (Common)" color="blue" expanded={expanded} toggle={toggle}>
                  {Object.entries(grouped.y1).map(([code, list]) => (
                    <FolderNode key={code} id={`yr1-${code}`} label={`${code} — ${courseName(code, list)}`} small color="slate" expanded={expanded} toggle={toggle}>
                      {list.map(r => <ResourceRow key={r.id} r={r} onDelete={handleDelete} canDelete={String(r.uploader_id) === String(currentUserId)} />)}
                    </FolderNode>
                  ))}
                </FolderNode>
              )}

              {/* STREAMS */}
              {Object.keys(grouped.streams).length > 0 && (
                <FolderNode id="streams" label="Streams" color="purple" expanded={expanded} toggle={toggle}>
                  {Object.entries(grouped.streams).map(([stream, data]) => (
                    <FolderNode key={stream} id={`stream-${stream}`} small color="slate" label={stream} expanded={expanded} toggle={toggle}>
                      {data.scheme.map(r => <ResourceRow key={r.id} r={r} onDelete={handleDelete} canDelete={String(r.uploader_id) === String(currentUserId)} />)}
                      {[2, 3, 4].map(yr => {
                        const courses = data.years[yr];
                        if (!courses || Object.keys(courses).length === 0) return null;
                        return (
                          <FolderNode key={yr} id={`stream-${stream}-y${yr}`} small color="slate" label={`Year ${yr}`} expanded={expanded} toggle={toggle}>
                            {Object.entries(courses).map(([code, list]) => (
                              <FolderNode key={code} id={`stream-${stream}-y${yr}-${code}`} small color="slate" label={`${code} — ${courseName(code, list)}`} expanded={expanded} toggle={toggle}>
                                {list.map(r => <ResourceRow key={r.id} r={r} onDelete={handleDelete} canDelete={String(r.uploader_id) === String(currentUserId)} />)}
                              </FolderNode>
                            ))}
                          </FolderNode>
                        );
                      })}
                    </FolderNode>
                  ))}
                </FolderNode>
              )}

              {/* MISC */}
              {grouped.misc.length > 0 && (
                <FolderNode id="misc" label="General / Misc" color="amber" expanded={expanded} toggle={toggle}>
                  {grouped.misc.map(r => <ResourceRow key={r.id} r={r} onDelete={handleDelete} canDelete={String(r.uploader_id) === String(currentUserId)} />)}
                </FolderNode>
              )}
            </div>
          )}

          <button
            onClick={() => {
              if (isGuest) { alert('Only verified Thapar users can upload to the Acad Vault.'); return; }
              setShowAdd(true);
            }}
            disabled={isGuest}
            className={`w-full mt-6 py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-all font-black uppercase tracking-widest shadow-inner
            ${isGuest ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 hover:border-blue-500/50'}`}
          >
            <Plus size={20} className={isGuest ? 'text-slate-600' : 'text-blue-500'} />
            {isGuest ? 'Upload Restricted' : 'Add Resource'}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <AddResourceModal
            onClose={() => setShowAdd(false)}
            onCreated={(r) => { setResources(prev => [r, ...prev]); setShowAdd(false); }}
            defaultStream={userStream}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ==========================================
// SUBCOMPONENTS
// ==========================================
function FolderNode({
  id, label, color = 'slate', small = false, expanded, toggle, children,
}: { id: string; label: string; color?: 'blue' | 'purple' | 'slate' | 'amber'; small?: boolean; expanded: Record<string, boolean>; toggle: (id: string) => void; children: React.ReactNode }) {
  const isOpen = !!expanded[id];
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400', purple: 'text-purple-400', amber: 'text-amber-400', slate: 'text-slate-500',
  };
  return (
    <div className={small ? '' : 'mb-2'}>
      <div onClick={() => toggle(id)} className={`flex items-center gap-2 cursor-pointer rounded-md transition-colors ${small ? 'text-slate-400 hover:text-white py-1.5 px-2 hover:bg-slate-800/50 text-sm' : 'text-slate-300 hover:text-white py-2 px-2 hover:bg-slate-800/50'}`}>
        {isOpen ? <ChevronDown size={small ? 14 : 18} className={colorMap[color]} /> : <ChevronRight size={small ? 14 : 18} className="text-slate-500" />}
        <FolderOpen size={small ? 16 : 18} className={colorMap[color]} />
        <span className="font-bold">{label}</span>
      </div>
      {isOpen && (
        <div className={`${small ? 'pl-5 ml-2 border-l border-slate-700/50' : 'pl-9 ml-4 border-l border-slate-700'} py-1 space-y-1.5`}>
          {children}
        </div>
      )}
    </div>
  );
}

function ResourceRow({ r, onDelete, canDelete }: { r: Resource; onDelete: (id: number) => void; canDelete: boolean }) {
  const isLink = r.source === 'link';
  return (
    <div className="flex flex-col text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-800">
      <div className="flex items-start gap-2 text-xs font-bold mb-1.5">
        {isLink ? <ExternalLink size={12} className="text-emerald-400 mt-0.5" /> : <FileText size={12} className="text-blue-400 mt-0.5" />}
        <a href={r.file_url} target="_blank" rel="noreferrer" className="flex-1 hover:text-white break-all">{r.title}</a>
        {canDelete && (
          <button onClick={() => onDelete(r.id)} className="text-slate-600 hover:text-red-400 shrink-0" title="Delete">
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="flex gap-1 flex-wrap items-center">
        {r.stream && <span className="text-[8px] bg-slate-800 px-1.5 rounded text-slate-500">{r.stream}</span>}
        {r.year && <span className="text-[8px] bg-slate-800 px-1.5 rounded text-slate-500">Year {r.year}</span>}
        {r.course_code && <span className="text-[8px] bg-slate-800 px-1.5 rounded text-slate-500">{r.course_code}</span>}
        {r.sub_tag && <span className="text-[8px] bg-blue-900/50 px-1.5 rounded text-blue-300">{r.sub_tag}</span>}
        {r.status === 'pending' && <span className="text-[8px] bg-amber-900/50 px-1.5 rounded text-amber-300 flex items-center gap-1"><Clock size={8} /> Pending</span>}
        {r.uploader_name && <span className="text-[8px] text-slate-600 ml-auto">by {r.uploader_name}</span>}
      </div>
    </div>
  );
}

// ==========================================
// ADD RESOURCE MODAL
// ==========================================
function AddResourceModal({
  onClose, onCreated, defaultStream,
}: { onClose: () => void; onCreated: (r: Resource) => void; defaultStream?: string }) {
  const token = localStorage.getItem('cf_token');

  const [source, setSource] = useState<'file' | 'link'>('file');
  const [kind, setKind] = useState<Kind | ''>('');
  const [stream, setStream] = useState<string>(defaultStream && THAPAR_STREAMS.includes(defaultStream) ? defaultStream : '');
  const [year, setYear] = useState<number | ''>('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [subTag, setSubTag] = useState<string>('PYQ');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch courses when year is known
  const courseYear = kind === 'YEAR1_COMMON' ? 1 : (kind === 'STREAM_COURSE' && typeof year === 'number' ? year : null);
  useEffect(() => {
    if (!courseYear) { setCourses([]); return; }
    axios.get(`${API_HOST}/acad/courses?year=${courseYear}&token=${token}`)
      .then(r => setCourses(r.data || []))
      .catch(() => setCourses([]));
  }, [courseYear]);

  // Auto-fill course name when code picked
  useEffect(() => {
    if (!courseCode) return;
    const match = courses.find(c => c.code === courseCode);
    if (match) setCourseName(match.name);
  }, [courseCode, courses]);

  const showStream = kind === 'STREAM_SCHEME' || kind === 'STREAM_COURSE';
  const showYear = kind === 'STREAM_COURSE';
  const showCourse = kind === 'YEAR1_COMMON' || kind === 'STREAM_COURSE';
  const showSubTag = kind === 'YEAR1_COMMON' || kind === 'STREAM_COURSE' || kind === 'MISC';

  const canSubmit = () => {
    if (!title.trim() || !kind) return false;
    if (source === 'file' && !file) return false;
    if (source === 'link' && !linkUrl.trim()) return false;
    if (showStream && !stream) return false;
    if (showYear && !year) return false;
    if (showCourse && !courseCode.trim()) return false;
    return true;
  };

  const submit = async () => {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      let fileUrl = linkUrl.trim();
      if (source === 'file' && file) {
        const presign = await axios.post(`${API_HOST}/acad/upload-url?token=${token}`, {
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
        });
        await axios.put(presign.data.upload_url, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        fileUrl = presign.data.public_url;
      }

      const body: any = {
        title: title.trim(),
        file_url: fileUrl,
        kind,
        source,
        sub_tag: showSubTag ? subTag : null,
      };
      if (showStream) body.stream = stream;
      if (showYear) body.year = year;
      if (showCourse) {
        body.course_code = courseCode.trim().toUpperCase();
        body.course_name = courseName.trim() || null;
      }

      const res = await axios.post(`${API_HOST}/acad/resources?token=${token}`, body);
      onCreated(res.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        className="fixed inset-0 bg-black/90 z-[200]" />
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        className="fixed inset-x-0 top-[5%] bottom-[5%] mx-auto max-w-md bg-slate-900 border-2 border-slate-700 rounded-2xl z-[210] flex flex-col overflow-hidden"
      >
        <div className="p-5 border-b-2 border-slate-800 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
            <UploadCloud size={22} /> Add Resource
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 hide-scrollbar space-y-4 font-sans">
          {/* SOURCE */}
          <Field label="How are you sharing this?">
            <div className="grid grid-cols-2 gap-2">
              <TogglePill active={source === 'file'} onClick={() => setSource('file')} icon={<FileUp size={16} />}>Upload File</TogglePill>
              <TogglePill active={source === 'link'} onClick={() => setSource('link')} icon={<LinkIcon size={16} />}>External Link</TogglePill>
            </div>
          </Field>

          {source === 'file' ? (
            <Field label="File">
              <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-3 px-3 bg-slate-950 border-2 border-dashed border-slate-700 rounded-lg text-left text-slate-400 hover:border-blue-500 transition-colors text-sm font-bold truncate">
                {file ? file.name : 'Tap to pick a file (PDF, image, etc.)'}
              </button>
            </Field>
          ) : (
            <Field label="Link URL">
              <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
          )}

          {/* KIND */}
          <Field label="What kind of resource is this?">
            <div className="grid grid-cols-2 gap-2">
              <KindPill active={kind === 'YEAR1_COMMON'} onClick={() => setKind('YEAR1_COMMON')}>Year 1 (Common)</KindPill>
              <KindPill active={kind === 'STREAM_SCHEME'} onClick={() => setKind('STREAM_SCHEME')}>Stream Scheme</KindPill>
              <KindPill active={kind === 'STREAM_COURSE'} onClick={() => setKind('STREAM_COURSE')}>Stream Course</KindPill>
              <KindPill active={kind === 'MISC'} onClick={() => setKind('MISC')}>General / Misc</KindPill>
            </div>
          </Field>

          {showStream && (
            <Field label="Stream">
              <select value={stream} onChange={e => setStream(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500">
                <option value="">— Select stream —</option>
                {THAPAR_STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}

          {showYear && (
            <Field label="Year">
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map(y => (
                  <TogglePill key={y} active={year === y} onClick={() => setYear(y)}>Year {y}</TogglePill>
                ))}
              </div>
            </Field>
          )}

          {showCourse && (
            <>
              <Field label="Course Code" hint={courses.length ? `${courses.length} known courses for year ${courseYear}` : undefined}>
                <input
                  list="acad-course-list"
                  value={courseCode}
                  onChange={e => setCourseCode(e.target.value.toUpperCase())}
                  placeholder="e.g. UCS503"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500 uppercase"
                />
                <datalist id="acad-course-list">
                  {courses.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </datalist>
              </Field>
              <Field label="Course Name (optional)">
                <input value={courseName} onChange={e => setCourseName(e.target.value)}
                  placeholder="e.g. Data Structures"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
              </Field>
            </>
          )}

          {showSubTag && (
            <Field label="Resource Type">
              <div className="flex gap-2 flex-wrap">
                {SUB_TAGS.map(t => (
                  <TogglePill key={t} active={subTag === t} onClick={() => setSubTag(t)} small>{t}</TogglePill>
                ))}
              </div>
            </Field>
          )}

          <Field label="Title" hint="Shown in the vault tree">
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={kind === 'STREAM_SCHEME' ? 'e.g. COE Scheme 2024-25' : 'e.g. Linked Lists PYQ 2023'}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
          </Field>

          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2 border-t border-slate-800">
            Uploads go to admin review before they appear for everyone. You'll see your own immediately as "Pending".
          </p>
        </div>

        <div className="p-4 border-t-2 border-slate-800 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 font-bold border-2 border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800">Cancel</button>
          <button onClick={submit} disabled={!canSubmit() || submitting}
            className={`flex-1 py-3 font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-colors ${canSubmit() && !submitting ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Uploading</> : 'Submit'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1 font-bold">{hint}</p>}
    </div>
  );
}

function TogglePill({ active, onClick, children, icon, small }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode; small?: boolean }) {
  return (
    <button onClick={onClick}
      className={`${small ? 'py-1.5 px-3 text-xs' : 'py-2.5 px-3 text-sm'} font-bold rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
      {icon} {children}
    </button>
  );
}

function KindPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`py-3 px-2 text-xs font-black uppercase tracking-wider rounded-lg border-2 transition-colors ${active ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
      {children}
    </button>
  );
}
