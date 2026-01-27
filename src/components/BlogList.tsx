'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface Post {
    id: number;
    created_at: string;
    title: string;
    content: string;
    title_ko?: string;
    content_ko?: string;
}

export default function BlogList({ posts }: { posts: Post[] }) {
    const [lang, setLang] = useState<'en' | 'ko'>('en');

    return (
        <div className="space-y-8">
            {/* Language Toggle */}
            <div className="flex justify-end">
                <div className="bg-gray-900 p-1 rounded-lg border border-gray-800 flex text-sm">
                    <button
                        onClick={() => setLang('en')}
                        className={`px-3 py-1 rounded-md transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        English
                    </button>
                    <button
                        onClick={() => setLang('ko')}
                        className={`px-3 py-1 rounded-md transition-colors ${lang === 'ko' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        한국어
                    </button>
                </div>
            </div>

            {posts.length === 0 ? (
                <p className="text-gray-500 text-center py-20">No posts yet. Wait for the daily close.</p>
            ) : (
                posts.map(post => {
                    const title = lang === 'en' ? post.title : (post.title_ko || post.title);
                    const content = lang === 'en' ? post.content : (post.content_ko || post.content);

                    return (
                        <article key={post.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-blue-500/30 transition-colors">
                            <div className="text-sm text-gray-500 mb-2">
                                {format(new Date(post.created_at), 'MMMM d, yyyy')}
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
                            <div className="prose prose-invert max-w-none text-gray-300">
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                        </article>
                    );
                })
            )}
        </div>
    );
}
