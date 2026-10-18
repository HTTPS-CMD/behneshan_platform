import { api } from '@/lib/api'; 
import Link from 'next/link';

export default async function AboutPage() {     
    let content = { title: "درباره ما", content: "در حال بارگذاری..." };     
    try {         
        const res = await api.get('/directory/content/about/');         
        content = res.data;     
    } catch (e) {         
        console.error("Error loading content:", e);
    }     

    return ( 
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
            
            {/* هدر سایت - کپی شده از استایل صفحه اصلی شما */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30">
                            📍
                        </div>
                        <div>
                            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-l from-slate-900 to-slate-700 block">چهارسوق</span>
                            <span className="text-[10px] text-slate-500 font-semibold block tracking-wide">معرفی و رشد کسب‌وکارها</span>
                        </div>
                    </Link>

                    <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-600 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all duration-300">
                        بازگشت به خانه
                    </Link>
                </div>
            </header>

            {/* بدنه اصلی محتوا */}
            <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-12">             
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 p-8 md:p-14">
                    <h1 className="text-3xl md:text-4xl font-black mb-8 text-slate-800 border-b border-gray-100 pb-6">
                        {content.title}
                    </h1>             
                    <div className="whitespace-pre-wrap leading-loose text-slate-700 text-lg font-medium">                 
                        {content.content}             
                    </div>         
                </div>
            </main>

            {/* فوتر مینیمال سایت */}
            <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 mt-auto">
                <div className="max-w-7xl mx-auto px-4 md:px-8 border-t border-slate-800 pt-8 text-center text-sm text-slate-500 font-medium">
                    تمامی حقوق مادی و معنوی برای پلتفرم چهارسوق محفوظ است.
                </div>
            </footer>
            
        </div>
    ); 
}