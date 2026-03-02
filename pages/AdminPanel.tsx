import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { Report, User } from '../types';
import { Shield, AlertTriangle, Trash2, UserX, MessageSquareOff, CheckCircle, XCircle } from 'lucide-react';
import { containsProfanity } from '../utils/profanity';

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'profanity'>('reports');
  const [profaneContent, setProfaneContent] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'moderator') {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load reports
      const fetchedReports = await db.getReports();
      setReports(fetchedReports);

      // In a real app, we would query the DB for all recent comments/reviews/topics
      // and filter them server-side. For this demo, we'll fetch a limited set or 
      // rely on reports primarily.
      // Let's simulate fetching recent content to check for profanity
      // (This is a simplified approach for demonstration)
      
      // Example: Fetching some recent topics to check
      const topics = await db.getForumTopics();
      const flaggedTopics = topics.filter(t => containsProfanity(t.title) || containsProfanity(t.content)).map(t => ({
        type: 'topic',
        id: t.id,
        content: t.title + ' - ' + t.content,
        author: t.author.name
      }));

      setProfaneContent([...flaggedTopics]);

    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    const success = await db.updateReportStatus(reportId, status);
    if (success) {
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    }
  };

  const handleDeleteItem = async (type: string, id: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить этот ${type}?`)) return;
    
    let success = false;
    if (type === 'topic') success = await db.deleteTopic(id);
    else if (type === 'comment') success = await db.deleteComment(id);
    else if (type === 'review') success = await db.deleteReview(id);

    if (success) {
      alert('Успешно удалено');
      loadAdminData(); // Reload data
    } else {
      alert('Ошибка при удалении');
    }
  };

  const handleUpdateUser = async (email: string, action: 'ban' | 'mute') => {
    // In a real app, we'd need the user's email or ID from the report
    // This is a simplified example
    const emailToUpdate = prompt(`Введите email пользователя для ${action === 'ban' ? 'бана' : 'мута'}:`, email);
    if (!emailToUpdate) return;

    const updates = action === 'ban' ? { isBanned: true } : { isMuted: true };
    const success = await db.updateUserStatus(emailToUpdate, updates);
    if (success) {
      alert(`Пользователь ${emailToUpdate} успешно ${action === 'ban' ? 'забанен' : 'замучен'}`);
    } else {
      alert('Ошибка при обновлении статуса пользователя');
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'moderator') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Доступ запрещен</h1>
        <p className="text-gray-400">У вас нет прав для просмотра этой страницы.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-indigo-500" />
        <h1 className="text-3xl font-bold text-white">Панель управления</h1>
      </div>

      <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'reports' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Жалобы ({reports.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('profanity')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'profanity' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Фильтр мата ({profaneContent.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : activeTab === 'reports' ? (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Нет активных жалоб</p>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
                      report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {report.status === 'pending' ? 'Ожидает' : report.status === 'resolved' ? 'Решено' : 'Отклонено'}
                    </span>
                    <h3 className="text-lg font-semibold text-white">Жалоба на {report.targetType} ({report.targetId})</h3>
                    <p className="text-sm text-gray-400">От: {report.reporterId} | Дата: {new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    {report.status === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateReportStatus(report.id, 'resolved')} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors" title="Отметить как решенное">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleUpdateReportStatus(report.id, 'dismissed')} className="p-2 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 transition-colors" title="Отклонить">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg mb-4">
                  <p className="text-gray-300"><span className="font-semibold text-white">Причина:</span> {report.reason}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleDeleteItem(report.targetType, report.targetId)} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm">
                    <Trash2 className="w-4 h-4" /> Удалить контент
                  </button>
                  {report.targetType === 'user' && (
                    <>
                      <button onClick={() => handleUpdateUser(report.targetId, 'ban')} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg hover:bg-orange-500/20 transition-colors text-sm">
                        <UserX className="w-4 h-4" /> Забанить
                      </button>
                      <button onClick={() => handleUpdateUser(report.targetId, 'mute')} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors text-sm">
                        <MessageSquareOff className="w-4 h-4" /> Замутить
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {profaneContent.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Подозрительный контент не найден</p>
          ) : (
            profaneContent.map((item, idx) => (
              <div key={idx} className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-400 uppercase">{item.type}</span>
                </div>
                <p className="text-white mb-2">{item.content}</p>
                <p className="text-sm text-gray-500 mb-4">Автор: {item.author}</p>
                <button onClick={() => handleDeleteItem(item.type, item.id)} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm">
                  <Trash2 className="w-4 h-4" /> Удалить
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
