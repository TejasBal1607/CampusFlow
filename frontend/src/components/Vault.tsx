import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Edit2, ArrowLeft, Plus, Camera, Users, Repeat, Check, Lock, ArrowUpRight, ArrowDownRight, Trash2, Loader2, Search, Download, AlertTriangle, X, FolderOpen, ChevronDown, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

// HELPER: Privacy Mask for Phone Numbers
const maskPhone = (phone: string | null | undefined) => {
  if (!phone || phone.length < 4) return 'No phone';
  return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
};

export default function Vault() {
  const token = localStorage.getItem('cf_token');
  const currentUserId = token ? parseInt(JSON.parse(atob(token.split('.')[1])).sub) : 1;

  const [userRole, setUserRole] = useState('student');
  const [currentView, setCurrentView] = useState('overview');
  const [activeModal, setActiveModal] = useState('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const currentMonthNum = currentDate.getMonth() + 1;
  
  const handlePrevMonth = () => setCurrentDate(new Date(year, currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, currentDate.getMonth() + 1));

  const [overviewData, setOverviewData] = useState({
    netCashIn: 0, totalExpenses: 0, globalSavings: 0, availableLimit: 0, 
    currentAvg: 0, idealAvg: 0, neededAvg: 0, allocations: {} as Record<string, number>
  });
  
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [incomesList, setIncomesList] = useState<any[]>([]);
  const [savingsList, setSavingsList] = useState<any[]>([]);
  const [ledgerList, setLedgerList] = useState<any[]>([]);

  const [showSplitUI, setShowSplitUI] = useState(false);
  const [showSettleAlert, setShowSettleAlert] = useState(false);

  // FIX: Force local timezone instead of UTC so entries don't save in the past month!
  const getTodayString = () => {
    const offset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - offset).toISOString().split('T')[0];
  };

  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    amount: '', title: '', category: 'Food', vendor: '', type: 'deposit', resolved: false, 
    date: getTodayString(), isRecurring: false, splitWith: [] as {id: number, name: string}[],
    otherUser: null as {id: number, name: string} | null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleViewChange = (e: any) => setCurrentView(e.detail);
    const handleModalChange = (e: any) => setActiveModal(e.detail);
    
    window.addEventListener('tour-vault-view', handleViewChange);
    window.addEventListener('tour-vault-modal', handleModalChange);
    
    return () => {
      window.removeEventListener('tour-vault-view', handleViewChange);
      window.removeEventListener('tour-vault-modal', handleModalChange);
    };
  }, []);

  const closeModal = () => {
    setActiveModal('none');
    setSelectedId(null);
    setShowSplitUI(false);
    setShowSettleAlert(false); 
    setSearchQuery('');
    setSearchResults([]);
    setFormData({ amount: '', title: '', category: 'Food', vendor: '', type: 'deposit', resolved: false, date: getTodayString(), isRecurring: false, splitWith: [], otherUser: null });
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const profileRes = await axios.get(`${API_HOST}/auth/me?token=${token}`);
      setUserRole(profileRes.data.role);
      const q = `?month=${currentMonthNum}&year=${year}`;
      const summaryRes = await axios.get(`${API_HOST}/finance/summary/${currentUserId}${q}`);
      const data = summaryRes.data;
      
      setOverviewData({
        netCashIn: (data.total_budget || 0) + (data.total_income || 0),
        totalExpenses: data.total_expenses || 0,
        globalSavings: data.total_savings_locked || 0,
        availableLimit: data.available_to_spend || 0,
        currentAvg: data.current_avg || 0,
        idealAvg: data.ideal_month_avg || 0,
        neededAvg: data.needed_avg || 0,
        allocations: data.category_breakdown || {}
      });

      const [expRes, ledgRes, incRes, savRes] = await Promise.all([
        axios.get(`${API_HOST}/expenses/user/${currentUserId}${q}`).catch(() => ({ data: [] })),
        axios.get(`${API_HOST}/ledger/user/${currentUserId}${q}`).catch(() => ({ data: [] })),
        axios.get(`${API_HOST}/finance/income/user/${currentUserId}${q}`).catch(() => ({ data: [] })),
        axios.get(`${API_HOST}/finance/savings/user/${currentUserId}${q}`).catch(() => ({ data: [] }))
      ]);

      setExpensesList(expRes.data);
      setLedgerList(ledgRes.data);
      setIncomesList(incRes.data);
      setSavingsList(savRes.data);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAllData(); }, [currentDate]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const token = localStorage.getItem('cf_token');
      const res = await axios.get(`${API_HOST}/users/?query=${query}&token=${token}`);
      setSearchResults(res.data);
    } catch (err: any) {
      console.error("Search failed", err.response?.data || err);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSplitFriend = (friend: {id: number, name: string}) => {
    setFormData(prev => {
      const exists = prev.splitWith.find(f => f.id === friend.id);
      return {
        ...prev,
        splitWith: exists 
          ? prev.splitWith.filter(f => f.id !== friend.id) 
          : [...prev.splitWith, friend]
      };
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSave = async (modalType: string) => {
    try {
      const amt = parseFloat(formData.amount) || 0;

      if (modalType === 'expense') {
        const payload = { 
          user_id: currentUserId,
          amount: amt, 
          description: formData.title || null, 
          category: formData.category, 
          vendor: formData.vendor || null, 
          date: formData.date || getTodayString(),
          is_recurring: formData.isRecurring,
          split_with: formData.splitWith.length > 0 ? formData.splitWith.map(f => f.id) : null
        };
        
        if (selectedId) {
          await axios.put(`${API_HOST}/expenses/${selectedId}`, payload);
          if (formData.splitWith.length > 0) {
            const expName = formData.title || "Expense";
            const linkedLedgers = ledgerList.filter(l => l.description === `Split: ${expName}`);
            const splitAmt = amt / (formData.splitWith.length + 1);
            await Promise.all(linkedLedgers.map(l => 
              axios.put(`${API_HOST}/ledger/${l.id}`, { ...l, amount: splitAmt, date: formData.date })
            ));
          }
        } else {
          await axios.post(`${API_HOST}/expenses/`, payload);
        }
      } 
      else if (modalType === 'income') {
        const payload = { 
          user_id: currentUserId, 
          amount: amt, 
          source: formData.title || 'Income', 
          description: formData.category || null, 
          created_at: formData.date || getTodayString(),
          is_recurring: formData.isRecurring
        };
        if (selectedId) await axios.put(`${API_HOST}/finance/income/${selectedId}`, payload);
        else await axios.post(`${API_HOST}/finance/income`, payload);
      } 
      else if (modalType === 'budget') {
        const payload = { user_id: currentUserId, month: currentMonthNum, year: year, amount: amt };
        await axios.post(`${API_HOST}/finance/budget`, payload);
      } 
      else if (modalType === 'ledger') {
        // ALLOW searchQuery to act as the unregistered user's name
        if (!formData.otherUser && !selectedId && !searchQuery.trim()) {
          alert("Please select a friend or type a name to attach this ledger to.");
          return;
        }

        const isBorrowing = formData.type === 'borrowed';
        
        if (selectedId) {
          await axios.put(`${API_HOST}/ledger/${selectedId}`, { amount: amt, description: formData.title || 'Misc Debt', date: formData.date });
        } else {
          const payload = { 
            lender_id: isBorrowing ? (formData.otherUser?.id || null) : currentUserId, 
            borrower_id: isBorrowing ? currentUserId : (formData.otherUser?.id || null), 
            unregistered_name: !formData.otherUser ? searchQuery.trim() : null,
            amount: amt, 
            description: formData.title || 'Misc Debt', 
            date: formData.date || getTodayString()
          };
          await axios.post(`${API_HOST}/ledger/`, payload);
        }
      }
      else if (modalType === 'savings') {
        const payload = { user_id: currentUserId, amount: amt, purpose: formData.title || 'Savings', created_at: formData.date || getTodayString() };
        if (selectedId) await axios.put(`${API_HOST}/finance/savings/${selectedId}`, payload);
        else {
          if (formData.type === 'deposit') await axios.post(`${API_HOST}/finance/savings/lock`, payload);
          else await axios.post(`${API_HOST}/finance/savings/withdraw`, payload);
        }
      }

      closeModal();
      await fetchAllData(); // FIX: Added await to ensure UI updates after backend finishes
    } catch (error: any) {
      const errDetail = error.response?.data?.detail;
      const msg = typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail, null, 2);
      alert(`Error saving data:\n${msg || 'Check console for details.'}`);
    }
  };

  const handleDelete = async (modalType: string) => {
    if (!selectedId) return;
    try {
      if (modalType === 'expense') {
        const itemToDelete = expensesList.find(e => e.id === selectedId);
        await axios.delete(`${API_HOST}/expenses/${selectedId}`);
        
        if (itemToDelete) {
          const expName = itemToDelete.title || itemToDelete.description || '';
          
          if (expName.startsWith('Settled Debt:')) {
            const baseDesc = expName.replace('Settled Debt: ', '');
            const linkedLedger = ledgerList.find(l => l.description === baseDesc && l.is_settled);
            if (linkedLedger) await axios.put(`${API_HOST}/ledger/${linkedLedger.id}`, { ...linkedLedger, is_settled: false });
          }
          
          const linkedLedgers = ledgerList.filter(l => l.description === `Split: ${expName}`);
          if (linkedLedgers.length > 0) {
            await Promise.all(linkedLedgers.map(l => axios.delete(`${API_HOST}/ledger/${l.id}`)));
          }
        }
      } 
      else if (modalType === 'income') {
        const itemToDelete = incomesList.find(i => i.id === selectedId);
        await axios.delete(`${API_HOST}/finance/income/${selectedId}`);
        
        if (itemToDelete) {
          const titleStr = itemToDelete.source || itemToDelete.title || itemToDelete.description || '';
          if (titleStr.startsWith('Settled Debt:')) {
            const baseDesc = titleStr.replace('Settled Debt: ', '');
            const linkedLedger = ledgerList.find(l => l.description === baseDesc && l.is_settled);
            if (linkedLedger) await axios.put(`${API_HOST}/ledger/${linkedLedger.id}`, { ...linkedLedger, is_settled: false });
          }
        }
      } 
      else if (modalType === 'ledger') {
        const itemToDelete = ledgerList.find(l => l.id === selectedId);
        await axios.delete(`${API_HOST}/ledger/${selectedId}`);
        
        if (itemToDelete && itemToDelete.is_settled) {
          const linkedExp = expensesList.find(e => (e.title || e.description) === `Settled Debt: ${itemToDelete.description}`);
          if (linkedExp) await axios.delete(`${API_HOST}/expenses/${linkedExp.id}`);
          
          const linkedInc = incomesList.find(i => (i.source || i.title || i.description) === `Settled Debt: ${itemToDelete.description}`);
          if (linkedInc) await axios.delete(`${API_HOST}/finance/income/${linkedInc.id}`);
        }
      }
      else if (modalType === 'savings') {
        await axios.delete(`${API_HOST}/finance/savings/${selectedId}`);
      }
      
      closeModal();
      await fetchAllData(); // FIX: Added await
    } catch (error) {
      console.error(`Failed to delete and sync:`, error);
    }
  };

  const handleSettleDebt = async () => {
    if (!selectedId) return;
    try {
      await axios.put(`${API_HOST}/ledger/settle/${selectedId}`);
      closeModal();
      await fetchAllData(); // FIX: Added await
    } catch (error) {
      console.error("Failed to settle debt", error);
    }
  };

  const handleOcrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    const ocrData = new FormData();
    ocrData.append('image', file); 
    try {
      const res = await axios.post(`${API_HOST}/expenses/ocr`, ocrData);
      setFormData(prev => ({
        ...prev,
        amount: res.data.amount?.toString() || prev.amount,
        title: res.data.description || res.data.title || prev.title,
        vendor: res.data.vendor || prev.vendor,
        category: res.data.category || prev.category,
      }));
    } catch (error) {
      alert("OCR failed. Check your Python terminal for errors.");
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const userName = localStorage.getItem('cf_name') || 'Student';

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CampusFLOW Financial Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated for: ${userName}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Period: ${monthName} ${year}`, pageWidth / 2, 34, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Summary', 14, 50);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Net Cash In: Rs. ${overviewData.netCashIn}`, 14, 60);
    doc.text(`Total Expenses: Rs. ${overviewData.totalExpenses}`, 14, 68);
    doc.text(`Savings: Rs. ${overviewData.globalSavings}`, 14, 76);
    
    doc.text(`Available Limit: Rs. ${overviewData.availableLimit}`, pageWidth / 2 + 10, 60);
    doc.text(`They Owe Me (+): Rs. ${activeLent}`, pageWidth / 2 + 10, 68);
    doc.text(`I Owe Them (-): Rs. ${activeBorrowed}`, pageWidth / 2 + 10, 76);

    let currentY = 90;

    const addSectionTable = (title: string, head: string[], body: any[]) => {
      if (body.length === 0) return;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [head],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { font: 'helvetica' }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    };

    const expData = [...expensesList].sort(sortByDate).map(e => [formatDate(e.date || e.created_at), e.title || e.description, e.category, `Rs. ${e.amount}`]);
    const incData = [...incomesList].sort(sortByDate).map(i => [formatDate(i.date || i.created_at), i.source || i.title, i.description || i.category, `Rs. ${i.amount}`]);
    const savData = [...savingsList].sort(sortByDate).map(s => [formatDate(s.date || s.created_at), s.purpose || s.title, s.amount > 0 ? 'Deposit' : 'Withdraw', `Rs. ${Math.abs(s.amount)}`]);
    const ledgData = [...ledgerList].sort(sortByDate).map(l => [formatDate(l.date || l.created_at), l.description || l.name, l.lender_id === currentUserId ? 'They Owe Me' : 'I Owe Them', `Rs. ${l.amount}`, l.is_settled ? 'Settled' : 'Pending']);

    addSectionTable('Expenses Log', ['Date', 'Details', 'Category', 'Amount'], expData);
    addSectionTable('Incomes Log', ['Date', 'Source', 'Description', 'Amount'], incData);
    addSectionTable('Vault Cache (Savings)', ['Date', 'Purpose', 'Type', 'Amount'], savData);
    addSectionTable('Debt Ledger', ['Date', 'Person/Reason', 'Type', 'Amount', 'Status'], ledgData);

    doc.save(`CampusFLOW_Report_${monthName}_${year}.pdf`);
  };

  const SquigglyArrow = ({ color }: { color: string }) => (
    <svg width="60" height="24" viewBox="0 0 60 24" className="overflow-visible"><path d="M 0,12 Q 10,5 20,12 T 40,12 Q 48,16 55,12 M 48,6 L 56,12 L 48,18" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const sortByDate = (a: any, b: any) => {
    const dateA = new Date(a.date || a.created_at || 0).getTime();
    const dateB = new Date(b.date || b.created_at || 0).getTime();
    return dateB - dateA;
  };

  const rawAverages = [
    { name: 'Current', val: overviewData.currentAvg, color: '#f87171', border: 'border-red-400/50', bg: 'bg-red-950/30', text: 'text-red-400' },
    { name: 'Ideal', val: overviewData.idealAvg, color: '#60a5fa', border: 'border-blue-400/50', bg: 'bg-blue-950/30', text: 'text-blue-400' },
    { name: 'Needed', val: overviewData.neededAvg, color: '#4ade80', border: 'border-green-400/50', bg: 'bg-green-950/30', text: 'text-green-400' }
  ];
  const sortedAverages = [...rawAverages].sort((a, b) => b.val - a.val);
  const axisPositions = ['top-[10%]', 'top-[45%]', 'top-[80%]'];

  const activeLent = ledgerList.filter(l => !l.is_settled && l.lender_id === currentUserId).reduce((sum, l) => sum + l.amount, 0);
  const activeBorrowed = ledgerList.filter(l => !l.is_settled && l.borrower_id === currentUserId).reduce((sum, l) => sum + l.amount, 0);

  const ActionButtons = ({ type, item }: { type: string, item: any }) => {
    const itemDate = item.date || item.created_at;
    
    let isCreator = false;
    if (item.creator_id) {
        isCreator = item.creator_id === currentUserId;
    } else {
        isCreator = item.lender_id === currentUserId; 
    }

    if (type === 'ledger' && !isCreator) {
      return (
        <div className="ml-2 pl-2 border-l border-slate-700/50 flex items-center justify-center" title="Only the creator/lender can edit this entry">
          <Lock size={16} className="text-slate-600" />
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 ml-2 border-l border-slate-700/50 pl-2">
        <button onClick={() => {
          setFormData({ 
            amount: Math.abs(item.amount)?.toString() || '', 
            title: item.title || item.source || item.purpose || item.description || '', 
            category: item.category || item.description || 'Other', 
            vendor: item.vendor || '', 
            type: item.type || (item.lender_id === currentUserId ? 'lent' : 'borrowed') || (item.amount > 0 ? 'deposit' : 'withdraw'), 
            resolved: item.is_settled || item.resolved || false,
            date: itemDate ? itemDate.split('T')[0] : getTodayString(),
            isRecurring: item.is_recurring || false,
            splitWith: [],
            otherUser: type === 'ledger' ? {
              id: item.lender_id === currentUserId ? item.borrower_id : item.lender_id,
              name: item.name || 'Selected User'
            } : null
          });
          setSelectedId(item.id);
          setActiveModal(type);
        }} className="text-slate-500 hover:text-blue-400 transition-colors"><Edit2 size={16} /></button>
        <button onClick={() => { setSelectedId(item.id); setActiveModal(`delete-${type}`); }} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
      </div>
    );
  };

  const renderOverview = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 pb-8">
      <div className="grid grid-cols-2 gap-4 mb-8 tour-vault-metrics">
        <motion.div onClick={() => setCurrentView('incomes')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="tour-vault-net cursor-pointer bg-slate-900/80 border-2 border-dashed border-slate-600 p-4 rounded-tl-xl rounded-br-2xl rotate-1 shadow-lg flex flex-col justify-center">
          <h3 className="text-lg text-slate-400 font-bold mb-1">Net Cash In</h3><p className="text-4xl font-extrabold text-green-400 mb-1">₹{overviewData.netCashIn}</p>
        </motion.div>
        <motion.div onClick={() => setCurrentView('expenses')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="tour-vault-exp cursor-pointer bg-slate-900/80 border-2 border-dashed border-slate-600 p-4 rounded-tr-xl rounded-bl-2xl -rotate-1 shadow-lg flex flex-col justify-center">
          <h3 className="text-lg text-slate-400 font-bold mb-1">Expenses</h3><p className="text-4xl font-extrabold text-red-400 mb-1">₹{overviewData.totalExpenses}</p>
        </motion.div>
        <motion.div onClick={() => setCurrentView('savings')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="tour-vault-sav cursor-pointer bg-slate-900/80 border-2 border-dashed border-slate-600 p-4 rounded-bl-xl rounded-tr-2xl -rotate-1 shadow-lg flex flex-col justify-center">
          <h3 className="text-lg text-slate-400 font-bold mb-1">Savings</h3><p className="text-4xl font-extrabold text-blue-400 mb-1">₹{overviewData.globalSavings}</p>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="tour-vault-avail bg-slate-900/80 border-2 border-dashed border-slate-600 p-4 rounded-br-xl rounded-tl-2xl rotate-1 shadow-lg flex flex-col justify-center relative">
          <div className="flex justify-between items-start mb-1"><h3 className="text-lg text-slate-400 font-bold">Available</h3><button onClick={() => setActiveModal('budget')} className="tour-vault-budget p-1 hover:text-yellow-400 bg-slate-800 rounded-md border border-slate-600"><Edit2 size={16} className="text-slate-300" /></button></div>
          <p className="text-4xl font-extrabold text-yellow-400 mb-1">₹{overviewData.availableLimit}</p>
        </motion.div>
      </div>

      <motion.div onClick={() => setCurrentView('ledger')} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="tour-vault-ledger cursor-pointer w-full bg-slate-900/80 border-2 border-dashed border-slate-500 p-5 rounded-xl shadow-lg relative mt-2">
        <h3 className="text-xl text-slate-300 font-bold mb-3 absolute -top-4 bg-slate-950 px-2 rotate-[-2deg]">Debt Ledger</h3>
        <div className="flex justify-between items-center mt-2">
          <div className="flex-1 text-center border-r-2 border-slate-700 border-dashed"><p className="text-4xl font-black text-green-400">+₹{activeLent}</p><p className="text-lg text-slate-500 font-bold">Lent</p></div>
          <div className="flex-1 text-center"><p className="text-4xl font-black text-red-400">-₹{activeBorrowed}</p><p className="text-lg text-slate-500 font-bold">Borrowed</p></div>
        </div>
      </motion.div>

      <div className="mt-8 tour-vault-avg">
        <h3 className="text-2xl font-bold mb-4 px-2 tracking-wide">Daily Burn Rate</h3>
        <div className="relative h-60 w-full ml-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-600 rounded-full"><div className="absolute top-[15%] -left-2 w-5 h-1 bg-slate-600"></div><div className="absolute top-[50%] -left-2 w-5 h-1 bg-slate-600"></div><div className="absolute top-[85%] -left-2 w-5 h-1 bg-slate-600"></div></div>
          {sortedAverages.map((avg, index) => (
            <div key={avg.name} className={`absolute ${axisPositions[index]} left-4 flex items-center gap-2`}><SquigglyArrow color={avg.color} /><div className={`border-2 ${avg.border} ${avg.bg} px-3 py-1 rounded-sm ${index === 1 ? '-rotate-1' : 'rotate-1'}`}><span className={`text-xl font-bold ${avg.text}`}>{avg.name}: ₹{avg.val}/day</span></div></div>
          ))}
        </div>
      </div>

      <div className="mt-6 tour-vault-alloc">
        <h3 className="text-2xl font-bold mb-6 px-2 tracking-wide">Resource Allocation</h3>
        <div className="flex items-center gap-8 px-4">
          {(() => {
            const allocs = overviewData.allocations;
            const total = Object.values(allocs).reduce((a, b) => a + b, 0) || 1; 
            const topCategories = Object.entries(allocs).sort((a, b) => b[1] - a[1]).slice(0, 7);
            const colors = ['#ef4444', '#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#64748b']; 
            const bgClasses = ['bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-green-500', 'bg-pink-500', 'bg-slate-500'];
            let currentPct = 0;
            const gradientParts = topCategories.map(([name, val], i) => { const pct = Math.round((val / total) * 100); const str = `${colors[i]} ${currentPct}% ${currentPct + pct}%`; currentPct += pct; return str; });
            const conicStr = gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(', ')})` : `conic-gradient(#334155 0% 100%)`;
            return (
              <>
                <div className="relative w-36 h-36 flex-shrink-0 rounded-full rotate-12 drop-shadow-[2px_4px_0px_rgba(0,0,0,0.4)]" style={{ background: conicStr }}><div className="absolute inset-4 bg-slate-950 rounded-full border-2 border-slate-800 border-dashed"></div><div className="absolute inset-0 rounded-full mix-blend-overlay opacity-60 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0px, #000 2px, transparent 2px, transparent 6px)' }}></div></div>
                <div className="flex flex-col gap-2 flex-1">{topCategories.length === 0 ? <span className="text-slate-500 font-bold">No data yet.</span> : topCategories.map(([name, val], i) => (<div key={name} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className={`w-4 h-4 ${bgClasses[i]} rounded-sm border-2 border-slate-900 shadow-[1px_1px_0_#fff]`}></div><span className="text-lg font-bold truncate max-w-[100px]">{name}</span></div><span className="text-lg font-extrabold opacity-80">{Math.round((val / total) * 100)}%</span></div>))}</div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="mt-12 flex justify-center pb-4">
        <motion.button 
          whileHover={{ scale: 1.05, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          onClick={generatePDF}
          className="tour-vault-export relative w-1/2 text-xl font-black text-blue-500 font-sans tracking-widest uppercase p-3 border-4 border-blue-500/80 border-dashed rounded-lg drop-shadow-[2px_4px_0px_rgba(59,130,246,0.2)] hover:bg-blue-500/10 transition-all select-none flex items-center justify-center gap-2"
        >
          <Download size={20} strokeWidth={3} />
          EXPORT
        </motion.button>
      </div>
    </motion.div>
  );

  const renderExpenses = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="relative h-full">
      <div className="absolute left-[22%] top-0 bottom-0 w-[2px] bg-red-500/30"></div><div className="absolute right-[35%] top-0 bottom-0 w-[2px] bg-red-500/30"></div>
      <div className="flex w-full pb-2 border-b-2 border-slate-700 mb-4 text-slate-400 font-bold text-lg"><div className="w-[22%] text-center">Date</div><div className="flex-1 px-4">Entry Details</div><div className="w-[35%] text-right pr-2">Amt/Act</div></div>
      <div className="tour-vault-log space-y-4 relative z-10 overflow-y-auto max-h-[65vh] pb-24 pr-1 hide-scrollbar">
        {[...expensesList].sort(sortByDate).map((item, i) => (
          <div key={item.id || i} className="flex items-center w-full py-2 group hover:bg-slate-800/30 rounded-md transition-colors">
            <div className="w-[22%] text-center text-lg font-bold text-slate-500 whitespace-nowrap">{formatDate(item.date || item.created_at)}</div>
            <div className="flex-1 px-4 flex flex-col justify-center overflow-hidden">
              <span className="text-xl font-bold flex items-center gap-2 truncate">
                {item.title || item.description}
                {item.is_recurring && <Repeat size={14} className="text-purple-400" />}
              </span>
              <span className="text-sm font-sans text-slate-400 tracking-wide truncate">{item.vendor} • {item.category}</span>
            </div>
            <div className="w-[35%] flex justify-end items-center pr-2 whitespace-nowrap flex-shrink-0">
              <span className="text-xl font-extrabold text-red-400">-₹{item.amount}</span>
              <ActionButtons type="expense" item={item} />
            </div>
          </div>
        ))}
      </div>
      <motion.button onClick={() => { closeModal(); setActiveModal('expense'); }} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="tour-vault-add absolute bottom-6 right-2 w-14 h-14 bg-red-400 text-slate-900 rounded-full flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border-2 border-slate-900 z-40"><Plus strokeWidth={3} size={32} /></motion.button>
    </motion.div>
  );

  const renderIncomes = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="relative h-full">
      <div className="absolute left-[22%] top-0 bottom-0 w-[2px] bg-green-500/30"></div><div className="absolute right-[32%] top-0 bottom-0 w-[2px] bg-green-500/30"></div>
      <div className="flex w-full pb-2 border-b-2 border-slate-700 mb-4 text-slate-400 font-bold text-lg"><div className="w-[22%] text-center">Date</div><div className="flex-1 px-4">Source Details</div><div className="w-[32%] text-right pr-2">Amt/Act</div></div>
      <div className="space-y-4 relative z-10 overflow-y-auto max-h-[65vh] pb-24 pr-1 hide-scrollbar">
        {[...incomesList].sort(sortByDate).map((item, i) => (
          <div key={item.id || i} className="flex items-center w-full py-2 group hover:bg-slate-800/30 rounded-md transition-colors">
            <div className="w-[22%] text-center text-lg font-bold text-slate-500 whitespace-nowrap">{formatDate(item.date || item.created_at)}</div>
            <div className="flex-1 px-4 flex flex-col justify-center overflow-hidden">
              <span className="text-xl font-bold flex items-center gap-2 truncate">
                {item.source || item.title}
                {item.is_recurring && <Repeat size={14} className="text-purple-400" />}
              </span>
              <span className="text-sm font-sans text-slate-400 tracking-wide truncate">{item.description || item.category}</span>
            </div>
            <div className="w-[32%] flex justify-end items-center pr-1 whitespace-nowrap flex-shrink-0">
              <span className="text-lg font-extrabold text-green-400">+₹{item.amount}</span>
              <ActionButtons type="income" item={item} />
            </div>
          </div>
        ))}
      </div>
      <motion.button onClick={() => { closeModal(); setActiveModal('income'); }} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="absolute bottom-6 right-2 w-14 h-14 bg-green-400 text-slate-900 rounded-full flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border-2 border-slate-900 z-40"><Plus strokeWidth={3} size={32} /></motion.button>
    </motion.div>
  );

  const renderSavings = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full flex flex-col">
      <div className="flex flex-col items-center bg-slate-900/80 border-4 border-dashed border-yellow-500/60 p-6 rounded-2xl mb-6 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
        <Lock size={48} className="text-yellow-400 mb-2 drop-shadow-md" /><p className="text-xl font-bold text-slate-400 tracking-widest uppercase">Total Treasure</p><p className="text-6xl font-black text-yellow-400 mt-2">₹{overviewData.globalSavings}</p>
      </div>
      <div className="flex w-full pb-2 border-b-2 border-slate-700 mb-4 text-slate-400 font-bold text-lg"><div className="w-[22%] text-center">Date</div><div className="flex-1 px-4">Log</div><div className="w-[30%] text-right pr-2">Impact</div></div>
      <div className="space-y-4 overflow-y-auto max-h-[40vh] pb-24 pr-1 hide-scrollbar">
        {[...savingsList].sort(sortByDate).map((item, i) => {
           const isDeposit = item.amount > 0;
           return (
            <div key={item.id || i} className="flex items-center w-full py-2 group hover:bg-slate-800/30 rounded-md transition-colors">
              <div className="w-[22%] text-center text-lg font-bold text-slate-500 whitespace-nowrap">{formatDate(item.date || item.created_at)}</div>
              <div className="flex-1 px-4 text-xl font-bold truncate">{item.purpose || item.title}</div>
              <div className="w-[30%] flex justify-end items-center pr-2 whitespace-nowrap flex-shrink-0">
                <span className={`text-xl font-extrabold ${isDeposit ? 'text-blue-400' : 'text-red-400'}`}>{isDeposit ? '+' : '-'}₹{Math.abs(item.amount)}</span>
                <ActionButtons type="savings" item={item}/>
              </div>
            </div>
          );
        })}
      </div>
      <motion.button onClick={() => { closeModal(); setActiveModal('savings'); }} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="absolute bottom-6 right-2 w-14 h-14 bg-blue-400 text-slate-900 rounded-full flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border-2 border-slate-900 z-40"><Plus strokeWidth={3} size={32} /></motion.button>
    </motion.div>
  );

  const renderLedger = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6 overflow-y-auto max-h-[75vh] pb-24 hide-scrollbar tour-vault-ledger">
      <div className="bg-slate-900/60 border-2 border-green-500/50 rounded-xl p-4">
        <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2"><ArrowDownRight /> They Owe Me</h3>
        <div className="space-y-4">
          {[...ledgerList].filter(l => l.lender_id === currentUserId).sort(sortByDate).map((item, i) => (
            <div key={item.id || i} className={`flex justify-between items-center group ${item.is_settled ? 'opacity-40' : ''}`}>
              <div className="flex flex-col overflow-hidden mr-2">
                <span className={`text-xl font-bold truncate ${item.is_settled ? 'line-through decoration-2' : ''}`}>{item.name || "Friend"}</span>
                <span className="text-sm text-slate-500 font-sans tracking-wide truncate">{item.description} • {formatDate(item.date || item.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                <span className={`text-2xl font-extrabold ${item.is_settled ? 'text-slate-500 line-through' : 'text-green-400'}`}>₹{item.amount}</span><ActionButtons type="ledger" item={item}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900/60 border-2 border-red-500/50 rounded-xl p-4">
        <h3 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2"><ArrowUpRight /> I Owe Them</h3>
        <div className="space-y-4">
          {[...ledgerList].filter(l => l.borrower_id === currentUserId).sort(sortByDate).map((item, i) => (
            <div key={item.id || i} className={`flex justify-between items-center group ${item.is_settled ? 'opacity-40' : ''}`}>
              <div className="flex flex-col overflow-hidden mr-2">
                <span className={`text-xl font-bold truncate ${item.is_settled ? 'line-through decoration-2' : ''}`}>{item.description || item.name}</span>
                <span className="text-sm text-slate-500 font-sans tracking-wide">Generated: {formatDate(item.date || item.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                <span className={`text-2xl font-extrabold ${item.is_settled ? 'text-slate-500 line-through' : 'text-red-400'}`}>₹{item.amount}</span><ActionButtons type="ledger" item={item}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <motion.button onClick={() => { closeModal(); setActiveModal('ledger'); }} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="fixed bottom-24 right-6 w-14 h-14 bg-slate-400 text-slate-900 rounded-full flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border-2 border-slate-900 z-40 tour-vault-add"><Plus strokeWidth={3} size={32} /></motion.button>
    </motion.div>
  );

  return (
    <div className="w-full min-h-screen pb-32 bg-slate-950 text-slate-100 font-caveat relative shadow-2xl border-x border-slate-800 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px]">
      
      <header className="sticky top-0 w-full z-30 bg-slate-950/90 backdrop-blur-md border-b-2 border-slate-800/80 px-4 py-4 mb-4">
        <div className="flex items-center justify-between">
          {currentView === 'overview' ? ( <button onClick={handlePrevMonth} className="p-1 hover:text-yellow-400"><ChevronLeft strokeWidth={3} /></button>
          ) : (<button onClick={() => setCurrentView('overview')} className="p-1 hover:text-yellow-400 flex items-center gap-1"><ArrowLeft strokeWidth={3} /> <span className="text-xl font-bold">Back</span></button>)}
          
          <h2 className="text-3xl font-bold tracking-wider">{currentView === 'overview' ? `${monthName} ${year}` : currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h2>
          
          <div className="flex items-center gap-2">
            {currentView === 'overview' && <button onClick={handleNextMonth} className="p-1 hover:text-yellow-400"><ChevronRight strokeWidth={3} /></button>}
          </div>
        </div>
      </header>

      <main className="px-4 pt-2">
        <AnimatePresence mode="wait">
          {currentView === 'overview' && <motion.div key="overview">{renderOverview()}</motion.div>}
          {currentView === 'expenses' && <motion.div key="expenses">{renderExpenses()}</motion.div>}
          {currentView === 'incomes' && <motion.div key="incomes">{renderIncomes()}</motion.div>}
          {currentView === 'savings' && <motion.div key="savings">{renderSavings()}</motion.div>}
          {currentView === 'ledger' && <motion.div key="ledger">{renderLedger()}</motion.div>}
        </AnimatePresence>
      </main>

      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleOcrUpload} />

      <AnimatePresence>
        {activeModal !== 'none' && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-black/70 z-[110] backdrop-blur-sm max-w-md mx-auto" />
            
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="tour-vault-modal fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#fdfbf7] text-slate-900 z-[120] pt-12 pb-16 px-6 drop-shadow-[0_-10px_10px_rgba(0,0,0,0.3)] overflow-y-auto max-h-[85vh] hide-scrollbar"
              style={{ clipPath: 'polygon(0 15px, 5% 0, 10% 15px, 15% 0, 20% 15px, 25% 0, 30% 15px, 35% 0, 40% 15px, 45% 0, 50% 15px, 55% 0, 60% 15px, 65% 0, 70% 15px, 75% 0, 80% 15px, 85% 0, 90% 15px, 95% 0, 100% 15px, 100% 100%, 0 100%)' }}
            >
              
              <button 
                onClick={closeModal} 
                className="absolute top-4 right-4 text-slate-400 hover:text-red-500 bg-slate-200 hover:bg-red-100 rounded-full p-1 transition-colors z-50"
              >
                <X size={24} />
              </button>

              {activeModal === 'expense' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-800">{selectedId ? 'Edit Expense' : 'New Expense'}</h2>
                    <button 
                      onClick={() => {
                        if (userRole === 'guest') return alert("Link a verified Thapar ID to use AI Receipt Scanning.");
                        fileInputRef.current?.click();
                      }} 
                      className={`tour-vault-ocr p-2 border-2 border-slate-300 rounded-full border-dashed flex items-center justify-center mr-8 transition-colors ${userRole === 'guest' ? 'text-slate-300 opacity-50 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {isOcrLoading ? <Loader2 className="animate-spin text-blue-500" size={24} /> : <Camera size={24} />}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="text-sm font-bold text-slate-500 uppercase">Amount (₹)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-4xl font-black text-red-600 focus:outline-none focus:border-slate-800 py-1" /></div>
                      <div className="w-[45%]"><label className="text-xs font-bold text-slate-500 uppercase">Date</label><input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1 pt-3" /></div>
                    </div>
                    <div><label className="text-sm font-bold text-slate-500 uppercase">What was it?</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Midnight Maggi" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-2xl font-bold focus:outline-none focus:border-slate-800 py-1" /></div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                        <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1 text-slate-800">
                          <option value="Food">Food</option>
                          <option value="Travel">Travel</option>
                          <option value="College">College</option>
                          <option value="Health">Health</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Debt Payment">Debt Payment</option>
                          <option value="Money Lent">Money Lent</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase">Vendor</label><input type="text" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} placeholder="Canteen" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1" /></div>
                    </div>

                    <div className="flex gap-4 pt-2">
                      {!selectedId ? (
                        <button onClick={() => setShowSplitUI(!showSplitUI)} className={`tour-vault-split flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold transition-colors ${showSplitUI || formData.splitWith.length > 0 ? 'bg-slate-800 text-white' : 'hover:bg-slate-200 text-slate-800'}`}>
                          <Users size={18} /> {formData.splitWith.length > 0 ? `Split (${formData.splitWith.length})` : 'Split'}
                        </button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-300 bg-slate-100 rounded-md font-bold text-slate-400 cursor-not-allowed">
                          <Lock size={16} /> Split Locked
                        </div>
                      )}
                      <button onClick={() => setFormData(prev => ({...prev, isRecurring: !prev.isRecurring}))} className={`tour-vault-repeat flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold transition-colors ${formData.isRecurring ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-slate-200 text-slate-800'}`}>
                        <Repeat size={18} /> Monthly
                      </button>
                    </div>

                    {showSplitUI && !selectedId && (
                      <div className="bg-slate-200 p-4 rounded-md border-2 border-slate-300 border-dashed mt-2">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Search Friend (Name or Phone)</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Type min 3 letters..."
                            className="w-full bg-white border-2 border-slate-300 rounded-md py-2 pl-9 pr-3 text-slate-800 font-bold focus:outline-none focus:border-blue-500 font-sans"
                          />
                          {isSearching && <Loader2 className="absolute right-3 top-2.5 animate-spin text-slate-400" size={18} />}
                        </div>

                        {searchResults.length > 0 && (
                          <div className="mt-2 bg-white border-2 border-slate-300 rounded-md shadow-sm overflow-hidden max-h-32 overflow-y-auto">
                            {searchResults.map(user => (
                              <div
                                key={user.id}
                                onClick={() => toggleSplitFriend(user)}
                                className="px-3 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                              >
                                <span className="font-bold text-slate-700 font-sans">{user.name}</span>
                                {/* Privacy check: Call the maskPhone helper! */}
                                <span className="text-xs text-slate-400 font-sans">{maskPhone(user.phone)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {formData.splitWith.length > 0 && (
                          <div className="mt-3">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Splitting With:</label>
                            <div className="flex flex-wrap gap-2">
                              {formData.splitWith.map(friend => (
                                <button
                                  key={friend.id}
                                  onClick={() => toggleSplitFriend(friend)}
                                  className="px-3 py-1 rounded-full text-sm font-bold border-2 bg-blue-500 text-white border-blue-500 transition-colors flex items-center gap-1 font-sans"
                                >
                                  {friend.name} <span className="text-[10px] opacity-70 ml-1">✕</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={() => handleSave('expense')} className="w-full mt-4 bg-red-500 text-white font-black text-2xl py-3 rounded-sm shadow-[4px_4px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-2">
                      <Check strokeWidth={4} /> STAMP IT
                    </button>
                  </div>
                </div>
              )}

              {activeModal === 'income' && (
                <div>
                  <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-800">{selectedId ? 'Edit Income' : 'Log Income'}</h2></div>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="text-sm font-bold text-slate-500 uppercase">Amount (₹)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-4xl font-black text-green-600 focus:outline-none focus:border-slate-800 py-1" /></div>
                      <div className="w-[45%]"><label className="text-xs font-bold text-slate-500 uppercase">Date</label><input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1 pt-3" /></div>
                    </div>
                    <div><label className="text-sm font-bold text-slate-500 uppercase">Source</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Freelance Pay" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-2xl font-bold focus:outline-none focus:border-slate-800 py-1" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Description</label><input type="text" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="UI Design Project" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1" /></div>
                    
                    <div className="flex gap-4 pt-2">
                      <button onClick={() => setFormData(prev => ({...prev, isRecurring: !prev.isRecurring}))} className={`w-full flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold transition-colors ${formData.isRecurring ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-slate-200 text-slate-800'}`}>
                        <Repeat size={18} /> Make Monthly
                      </button>
                    </div>
                    <button onClick={() => handleSave('income')} className="w-full mt-4 bg-green-500 text-white font-black text-2xl py-3 rounded-sm shadow-[4px_4px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-2"><Check strokeWidth={4} /> DEPOSIT IT</button>
                  </div>
                </div>
              )}

              {activeModal === 'budget' && (
                <div>
                  <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-800">Set Budget</h2></div>
                  <div className="space-y-6">
                    <div><label className="text-sm font-bold text-slate-500 uppercase">Monthly Limit (₹)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="6000" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-4xl font-black text-yellow-500 focus:outline-none focus:border-slate-800 py-2" /></div>
                    <button onClick={() => handleSave('budget')} className="w-full mt-8 bg-yellow-400 text-slate-900 font-black text-2xl py-3 rounded-sm shadow-[4px_4px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-2"><Check strokeWidth={4} /> UPDATE SPEC</button>
                  </div>
                </div>
              )}

              {activeModal.startsWith('delete-') && (
                <div>
                  <div className="flex justify-between items-center mb-4"><h2 className="text-3xl font-extrabold uppercase tracking-widest text-red-600">Delete Record?</h2></div>
                  <p className="text-xl font-bold text-slate-600 mb-8 leading-tight">This action cannot be undone. Are you sure you want to shred this receipt?</p>
                  <div className="flex gap-4">
                    <button onClick={closeModal} className="flex-1 py-3 border-2 border-slate-400 rounded-sm font-black text-xl hover:bg-slate-200 text-slate-600">CANCEL</button>
                    <button onClick={() => handleDelete(activeModal.split('-')[1])} className="flex-1 bg-red-500 text-white font-black text-xl py-3 rounded-sm shadow-[4px_4px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-2"><Trash2 strokeWidth={3} /> SHRED IT</button>
                  </div>
                </div>
              )}

              {activeModal === 'savings' && (
                <div>
                  <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-800">{selectedId ? 'Edit Vault Cache' : 'Vault Cache'}</h2></div>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="text-sm font-bold text-slate-500 uppercase">Amount (₹)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-4xl font-black text-blue-600 focus:outline-none focus:border-slate-800 py-1" /></div>
                      <div className="w-[45%]"><label className="text-xs font-bold text-slate-500 uppercase">Date</label><input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1 pt-3" /></div>
                    </div>
                    <div><label className="text-sm font-bold text-slate-500 uppercase">Purpose</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Freelance Bonus" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-2xl font-bold focus:outline-none focus:border-slate-800 py-1" /></div>
                    <div className="flex gap-4 pt-2">
                      <button onClick={() => setFormData({...formData, type: 'withdraw'})} className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold ${formData.type === 'withdraw' ? 'bg-red-500 text-white' : 'text-red-600 hover:bg-slate-200'}`}>Withdraw</button>
                      <button onClick={() => setFormData({...formData, type: 'deposit'})} className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold ${formData.type === 'deposit' ? 'bg-blue-500 text-white' : 'text-blue-600 hover:bg-slate-200'}`}>Deposit</button>
                    </div>
                    <button onClick={() => handleSave('savings')} className="w-full mt-4 bg-blue-500 text-white font-black text-2xl py-3 rounded-sm shadow-[4px_4px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-2"><Check strokeWidth={4} /> LOG IT</button>
                  </div>
                </div>
              )}

              {activeModal === 'ledger' && (
                <div>
                  <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-800">{selectedId ? 'Edit Ledger Entry' : 'New Ledger Entry'}</h2></div>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="text-sm font-bold text-slate-500 uppercase">Amount (₹)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-4xl font-black text-slate-800 focus:outline-none focus:border-slate-800 py-1" /></div>
                      <div className="w-[45%]"><label className="text-xs font-bold text-slate-500 uppercase">Date</label><input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-lg font-bold focus:outline-none focus:border-slate-800 py-1 pt-3" /></div>
                    </div>
                    
                    <div><label className="text-sm font-bold text-slate-500 uppercase">Reason</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Canteen Lunch" className="w-full bg-transparent border-b-2 border-slate-400 border-dashed text-2xl font-bold focus:outline-none focus:border-slate-800 py-1" /></div>

                    <div className="bg-slate-200 p-4 rounded-md border-2 border-slate-300 border-dashed mt-2">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Select Person</label>
                      
                      {!formData.otherUser ? (
                        <div>
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => handleSearch(e.target.value)}
                              placeholder="Search by name/phone or type a guest name..."
                              className="w-full bg-white border-2 border-slate-300 rounded-md py-2 pl-9 pr-3 text-slate-800 font-bold focus:outline-none focus:border-blue-500 font-sans"
                            />
                            {isSearching && <Loader2 className="absolute right-3 top-2.5 animate-spin text-slate-400" size={18} />}
                          </div>
                          {searchQuery.trim().length > 0 && searchResults.length === 0 && !isSearching && (
                             <p className="text-[10px] text-slate-500 font-bold mt-1.5 ml-1 font-sans">
                               No account found. Will save as guest: "{searchQuery.trim()}"
                             </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-sm font-bold border-2 bg-blue-500 text-white border-blue-500 font-sans">
                            {formData.otherUser.name}
                          </span>
                          {!selectedId && (
                            <button onClick={() => setFormData({...formData, otherUser: null})} className="text-red-500 text-xs font-bold uppercase hover:underline">Change</button>
                          )}
                        </div>
                      )}

                      {!formData.otherUser && searchResults.length > 0 && (
                        <div className="mt-2 bg-white border-2 border-slate-300 rounded-md shadow-sm overflow-hidden max-h-32 overflow-y-auto">
                          {searchResults.map(user => (
                            <div
                              key={user.id}
                              onClick={() => {
                                setFormData({...formData, otherUser: user});
                                setSearchQuery('');
                                setSearchResults([]);
                              }}
                              className="px-3 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                            >
                              <span className="font-bold text-slate-700 font-sans">{user.name}</span>
                              {/* Privacy check: Call the maskPhone helper! */}
                              <span className="text-xs text-slate-400 font-sans">{maskPhone(user.phone)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button onClick={() => setFormData({...formData, type: 'borrowed'})} className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold ${formData.type === 'borrowed' ? 'bg-red-500 text-white' : 'text-red-600 hover:bg-slate-200'}`}>I Owe</button>
                      <button onClick={() => setFormData({...formData, type: 'lent'})} className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold ${formData.type === 'lent' ? 'bg-green-500 text-white' : 'text-green-600 hover:bg-slate-200'}`}>They Owe</button>
                    </div>

                    {showSettleAlert ? (
                      <div className="bg-yellow-500/10 border-2 border-yellow-500/50 p-4 rounded-md mt-4 animate-in fade-in slide-in-from-top-4 duration-200">
                        <h4 className="text-yellow-600 font-black text-lg flex items-center gap-2 mb-1"><AlertTriangle size={20}/> Confirm Settlement</h4>
                        <p className="text-sm font-bold text-slate-600 font-sans mb-4">
                          This will mark the debt as paid and automatically log the {formData.type === 'lent' ? 'income' : 'expense'} in your vault.
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setShowSettleAlert(false)} className="flex-1 py-2 border-2 border-slate-400 text-slate-500 font-bold rounded-md hover:bg-slate-100">Cancel</button>
                          <button onClick={handleSettleDebt} className="flex-1 py-2 bg-yellow-500 text-white font-black rounded-md shadow-[2px_2px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-px hover:shadow-none transition-all">Settle It</button>
                        </div>
                      </div>
                    ) : (
                      selectedId && !formData.resolved && (
                        <button onClick={() => setShowSettleAlert(true)} className="w-full flex items-center justify-center gap-2 py-2 border-2 border-slate-800 rounded-md font-bold hover:bg-slate-200 mt-2 text-slate-600 transition-colors">
                          <Check size={18} /> Mark as Resolved
                        </button>
                      )
                    )}

                    <button onClick={() => handleSave('ledger')} className="w-full mt-4 bg-slate-800 text-white font-black text-2xl py-3 rounded-sm shadow-[4px_4px_0px_#1e293b] border-2 border-slate-800 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-2"><Check strokeWidth={4} /> {selectedId ? 'UPDATE' : 'LOG'} DEBT</button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}