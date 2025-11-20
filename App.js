import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, doc, onSnapshot, collection, query, setDoc, updateDoc, 
    arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc, orderBy, 
    limit, where, getDocs 
} from 'firebase/firestore';

// --- Icon Imports (Inline SVG & Logos) ---

const InstagramLogo = () => (
    <svg className="h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
);

const HeartIcon = ({ filled, onClick, className }) => (
    <svg onClick={onClick} className={`w-6 h-6 cursor-pointer transition-all ${className}`} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
        {filled ? (
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-.318-.318a4.5 4.5 0 00-6.364 0z" />
        ) : (
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-.318-.318a4.5 4.5 0 00-6.364 0z" />
        )}
    </svg>
);

const CommentIcon = ({ onClick, className }) => (
    <svg onClick={onClick} className={`w-6 h-6 cursor-pointer ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.702-1.125L3 21l1.125-3.702A9.86 9.86 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

const MessageIcon = ({ className }) => (
    <svg className={`w-6 h-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-1 12H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2z" />
    </svg>
);

const HomeIcon = ({ className }) => (
    <svg className={`w-6 h-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

const ProfileIcon = ({ className }) => (
    <svg className={`w-6 h-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const PlusCircleIcon = ({ className }) => (
    <svg className={`w-8 h-8 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const SearchIcon = ({ className }) => (
    <svg className={`w-6 h-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const BackIcon = ({ onClick, className }) => (
    <svg onClick={onClick} className={`w-6 h-6 cursor-pointer ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

// --- Constants ---
const VIEWS = {
    FEED: 'feed',
    PROFILE: 'profile',
    CREATE: 'create',
    VIEW_USER: 'view_user',
    MESSAGES: 'messages',
    CHAT_ROOM: 'chat_room',
    SEARCH: 'search'
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Utility for fetching public collection path
const getPublicCollection = (db, collectionName) => {
    return collection(db, `artifacts/${appId}/public/data/${collectionName}`);
};

const getChatId = (uid1, uid2) => {
    // Sort UIDs to create a consistent chat ID
    return [uid1, uid2].sort().join('_');
};

// --- Main App Component ---

const App = () => {
    // Firebase State
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Application Data State
    const [currentUser, setCurrentUser] = useState(null);
    const [allUsers, setAllUsers] = useState({});
    const [posts, setPosts] = useState([]);
    const [activeChat, setActiveChat] = useState(null); // stores targetUserId for CHAT_ROOM

    // UI State
    const [currentView, setCurrentView] = useState(VIEWS.FEED);
    const [targetUserId, setTargetUserId] = useState(null); // Used for VIEW_USER profile
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    // --- Firebase Initialization and Auth ---

    useEffect(() => {
        // Initialize Firebase
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);

            setDb(firestore);
            setAuth(authInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    const userRef = doc(getPublicCollection(firestore, 'users'), user.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists() || !userSnap.data().username) {
                        setCurrentUser({ uid: user.uid, username: null, bio: '', followedBy: [], following: [] });
                    } else {
                        setCurrentUser(userSnap.data());
                    }
                } else {
                    if (initialAuthToken) {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setErrorMessage("Failed to initialize the app. Check console for details.");
        }
    }, []);

    // --- Firestore Data Listeners (Users and Posts) ---

    useEffect(() => {
        if (!db || !isAuthReady || !userId) return;

        // Listener for All Users
        const usersRef = getPublicCollection(db, 'users');
        const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
            const usersMap = {};
            snapshot.forEach(doc => {
                usersMap[doc.id] = doc.data();
            });
            setAllUsers(usersMap);
            if (usersMap[userId] && usersMap[userId].username) {
                setCurrentUser(usersMap[userId]);
            }
        }, (error) => console.error("Error fetching users:", error));

        // Listener for All Posts (Client-side sorted)
        const postsRef = getPublicCollection(db, 'posts');
        const unsubscribePosts = onSnapshot(postsRef, (snapshot) => {
            const newPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Client-side sort: newest first
            newPosts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setPosts(newPosts);
        }, (error) => console.error("Error fetching posts:", error));


        return () => {
            unsubscribeUsers();
            unsubscribePosts();
        };
    }, [db, isAuthReady, userId]);

    // --- Core Interaction Functions ---

    const handleCreateProfile = async (username, bio) => {
        if (!db || !userId) { setErrorMessage("Authentication not complete."); return; }
        if (!username || username.length < 3) { setErrorMessage("Username must be at least 3 characters long."); return; }

        // Simple check for username uniqueness (not secure, but good for demo)
        const isDuplicate = Object.values(allUsers).some(user => user.username?.toLowerCase() === username.toLowerCase());
        if (isDuplicate) { setErrorMessage("This username is already taken. Please choose another."); return; }

        try {
            const userRef = doc(getPublicCollection(db, 'users'), userId);
            const newUserProfile = {
                uid: userId,
                username: username,
                bio: bio || '',
                followedBy: [], 
                following: [], 
            };

            await setDoc(userRef, newUserProfile);
            setCurrentUser(newUserProfile);
            setErrorMessage('');
        } catch (error) {
            console.error("Error creating profile:", error);
            setErrorMessage("Failed to create profile: " + error.message);
        }
    };

    const handleToggleLike = useCallback(async (postId, isLiked) => {
        if (!db || !userId) return;
        try {
            const postRef = doc(getPublicCollection(db, 'posts'), postId);
            const updateAction = isLiked ? arrayRemove(userId) : arrayUnion(userId);
            await updateDoc(postRef, { likes: updateAction });
        } catch (error) { console.error("Error toggling like:", error); }
    }, [db, userId]);

    const handleAddComment = useCallback(async (postId, text) => {
        if (!db || !userId || !currentUser) return;
        if (!text.trim()) return;

        try {
            const postRef = doc(getPublicCollection(db, 'posts'), postId);
            const newComment = {
                userId: userId,
                username: currentUser.username,
                text: text,
                timestamp: new Date().toISOString(), 
            };

            await updateDoc(postRef, { comments: arrayUnion(newComment) });
            setShowCommentModal(false);
            setSelectedPostId(null);
        } catch (error) { console.error("Error adding comment:", error); }
    }, [db, userId, currentUser]);

    const handleToggleFollow = useCallback(async (targetUid) => {
        if (!db || !userId || userId === targetUid) return;

        const isFollowing = currentUser?.following.includes(targetUid);

        try {
            // 1. Update Current User's 'following' list
            const userRef = doc(getPublicCollection(db, 'users'), userId);
            await updateDoc(userRef, {
                following: isFollowing ? arrayRemove(targetUid) : arrayUnion(targetUid)
            });

            // 2. Update Target User's 'followedBy' list
            const targetRef = doc(getPublicCollection(db, 'users'), targetUid);
            await updateDoc(targetRef, {
                followedBy: isFollowing ? arrayRemove(userId) : arrayUnion(userId)
            });

        } catch (error) { console.error("Error toggling follow:", error); }
    }, [db, userId, currentUser]);

    const handleSendMessage = useCallback(async (targetUid, text) => {
        if (!db || !userId || !text.trim()) return;

        const chatId = getChatId(userId, targetUid);
        const chatRef = doc(getPublicCollection(db, 'chats'), chatId);

        const newMessage = {
            senderId: userId,
            senderUsername: currentUser.username,
            text: text,
            timestamp: serverTimestamp(),
        };

        try {
            // 1. Add message to the messages subcollection
            await addDoc(collection(chatRef, 'messages'), newMessage);

            // 2. Update/Create the chat document itself to store last message/participants
            await setDoc(chatRef, {
                participants: [userId, targetUid],
                lastMessage: text,
                lastSent: serverTimestamp(),
                // Store usernames for easy display in the inbox
                [userId]: currentUser.username, 
                [targetUid]: allUsers[targetUid]?.username || 'User',
            }, { merge: true });

        } catch (error) { console.error("Error sending message:", error); }
    }, [db, userId, currentUser, allUsers]);

    // --- UI Components ---

    const Post = ({ post }) => {
        const isLiked = post.likes?.includes(userId);
        const postUser = allUsers[post.userId];
        const username = postUser ? postUser.username : "Unknown User";

        const handleCommentClick = () => { setSelectedPostId(post.id); setShowCommentModal(true); };
        const handleProfileView = (uid) => { setTargetUserId(uid); setCurrentView(VIEWS.VIEW_USER); };

        return (
            <div className="bg-white border border-gray-200 mb-4 max-w-xl mx-auto rounded-lg shadow-sm">
                {/* Header */}
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleProfileView(post.userId)}>
                        <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {username[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-semibold text-gray-800 text-sm hover:text-indigo-600 transition">
                            {username}
                        </span>
                    </div>
                </div>

                {/* Image / Content */}
                <div className="w-full h-80 bg-gray-100 overflow-hidden">
                    {post.imageUrl ? (
                        <img 
                            src={post.imageUrl} 
                            alt={post.caption} 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                                e.target.onerror = null; 
                                e.target.src="https://placehold.co/600x400/1e293b/94a3b8?text=Image+Load+Failed";
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-base font-medium">
                            No Image Provided
                        </div>
                    )}
                </div>

                {/* Actions & Likes */}
                <div className="p-3">
                    <div className="flex space-x-4 mb-1 items-center">
                        <HeartIcon 
                            filled={isLiked} 
                            onClick={() => handleToggleLike(post.id, isLiked)} 
                            className={isLiked ? "text-red-500 transform scale-110" : "text-gray-600 hover:text-red-500"} 
                        />
                        <CommentIcon onClick={handleCommentClick} className="text-gray-600 hover:text-indigo-500" />
                        <MessageIcon className="text-gray-600 hover:text-indigo-500 rotate-45" />
                    </div>

                    <div className="text-sm font-semibold mb-1">
                        {post.likes?.length || 0} likes
                    </div>

                    {/* Caption */}
                    <div className="text-sm mb-1">
                        <span className="font-semibold mr-1 cursor-pointer" onClick={() => handleProfileView(post.userId)}>{username}</span>
                        <span className="text-gray-800">{post.caption}</span>
                    </div>

                    {/* Comments Preview */}
                    {post.comments?.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1 cursor-pointer" onClick={handleCommentClick}>
                            View all {post.comments.length} comments
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const PostFeed = () => {
        // No search filtering in the PostFeed anymore, as search is now a dedicated tab
        const filteredPosts = posts; 

        return (
            <div className="p-2 pt-4 pb-16 max-w-xl mx-auto min-h-screen">
                {filteredPosts.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                        "Be the first to post! Go to the 'Create' tab."
                    </div>
                ) : (
                    filteredPosts.map(post => <Post key={post.id} post={post} />)
                )}
            </div>
        );
    };

    const ProfileView = ({ uid }) => {
        const profileUser = allUsers[uid];
        const isCurrentUser = uid === userId;

        if (!profileUser) {
            return <div className="text-center p-8">User profile not found.</div>;
        }

        const userPosts = posts.filter(p => p.userId === uid);
        const isFollowing = isCurrentUser ? false : currentUser?.following.includes(uid);
        const handleFollow = () => handleToggleFollow(uid);

        return (
            <div className="p-4 pt-8 max-w-4xl mx-auto pb-16">
                {/* Profile Header */}
                <div className="flex items-center space-x-6 pb-6 border-b border-gray-200">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-pink-400 rounded-full flex items-center justify-center text-white font-extrabold text-3xl shadow-lg flex-shrink-0">
                        {profileUser.username[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-grow">
                        <div className="flex items-center space-x-3 mb-2">
                            <h1 className="text-2xl font-light text-gray-800">{profileUser.username}</h1>
                            {!isCurrentUser && (
                                <button
                                    onClick={handleFollow}
                                    className={`px-3 py-1 rounded-lg font-semibold text-sm transition-colors shadow-md ${
                                        isFollowing 
                                            ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                                    }`}
                                >
                                    {isFollowing ? 'Unfollow' : 'Follow'}
                                </button>
                            )}
                        </div>

                        <div className="flex space-x-4 sm:space-x-8 text-gray-700 mb-2 text-sm sm:text-base">
                            <span className="text-md">
                                <span className="font-semibold">{userPosts.length}</span> posts
                            </span>
                            <span className="text-md">
                                <span className="font-semibold">{profileUser.followedBy?.length || 0}</span> followers
                            </span>
                            <span className="text-md">
                                <span className="font-semibold">{profileUser.following?.length || 0}</span> following
                            </span>
                        </div>

                        <p className="text-sm font-medium text-gray-800 mt-2">{profileUser.bio || "No bio yet."}</p>
                        <p className="text-xs text-gray-500 mt-1">ID: {uid}</p>
                    </div>
                </div>

                {/* User Posts Grid */}
                <div className="grid grid-cols-3 gap-1 mt-6">
                    {userPosts.length > 0 ? (
                        userPosts.map(post => (
                            <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden relative group cursor-pointer">
                                <img 
                                    src={post.imageUrl || "https://placehold.co/300x300/e5e7eb/4b5563?text=Post"} 
                                    alt="Post thumbnail" 
                                    className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-70"
                                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/300x300/e5e7eb/4b5563?text=Post+No+Image"; }}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="text-white text-center text-sm">
                                        <p className="font-bold mb-1 flex items-center"><HeartIcon filled className="w-4 h-4 mr-1 text-white" /> {post.likes?.length || 0}</p>
                                        <p className="flex items-center"><CommentIcon className="w-4 h-4 mr-1 text-white" /> {post.comments?.length || 0}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 text-center text-gray-500 p-8 border-dashed border-2 border-gray-300 rounded-lg mt-4">
                            {isCurrentUser ? "You haven't made any posts yet." : `${profileUser.username} has no posts.`}
                        </div>
                    )}
                </div>
            </div>
        );
    };
    
    const SearchView = () => {
        const [search, setSearch] = useState('');
        
        const filteredUsers = useMemo(() => {
            if (!search.trim()) return [];
            const searchLower = search.toLowerCase();
            
            return Object.values(allUsers)
                .filter(user => user.username && user.uid !== userId && user.username.toLowerCase().includes(searchLower))
                .sort((a, b) => a.username.localeCompare(b.username)); // Sort alphabetically
        }, [search, allUsers, userId]);

        const handleViewUser = (uid) => {
            setTargetUserId(uid);
            setCurrentView(VIEWS.VIEW_USER);
            setSearch(''); // Clear search on navigation
        };

        return (
            <div className="p-4 pt-8 max-w-xl mx-auto pb-16">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Search Profiles</h1>
                <div className="relative mb-6">
                    <input
                        type="text"
                        placeholder="Search Instagram profiles by username..."
                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 transition shadow-md text-base"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                
                {filteredUsers.length > 0 && (
                    <div className="space-y-4">
                        {filteredUsers.map(user => (
                            <div 
                                key={user.uid} 
                                className="flex items-center p-4 bg-white rounded-xl shadow-lg border border-gray-100 cursor-pointer transition transform hover:scale-[1.01] hover:shadow-xl"
                                onClick={() => handleViewUser(user.uid)}
                            >
                                <div className="w-14 h-14 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 mr-4">
                                    {user.username[0]?.toUpperCase()}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-bold text-lg text-gray-900 truncate">{user.username}</p>
                                    <p className="text-sm text-gray-500 truncate mt-0.5">{user.bio || 'No bio provided.'}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <p className="font-semibold text-base text-pink-600">{user.followedBy?.length || 0}</p>
                                    <p className="text-xs text-gray-500">Followers</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {search.trim() && filteredUsers.length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-lg bg-white rounded-xl mt-4 border border-dashed border-gray-300">
                        No profile found for "{search}".
                    </p>
                )}
                 {!search.trim() && (
                    <p className="text-center text-gray-500 py-8 text-lg bg-white rounded-xl mt-4 border border-dashed border-gray-300">
                        Type a username to start searching profiles.
                    </p>
                )}
            </div>
        );
    }

    const PostCreator = () => {
        const [caption, setCaption] = useState('');
        const [imageUrl, setImageUrl] = useState('');
        const [isPosting, setIsPosting] = useState(false);

        const handlePost = async () => {
            if (!db || !userId || !currentUser || !currentUser.username) {
                setErrorMessage("Cannot post. User not authenticated or profile incomplete.");
                return;
            }
            if (caption.trim().length < 5) {
                setErrorMessage("Caption must be at least 5 characters long.");
                return;
            }

            setIsPosting(true);
            setErrorMessage('');

            try {
                const postsRef = getPublicCollection(db, 'posts');
                await addDoc(postsRef, {
                    userId: userId,
                    username: currentUser.username,
                    caption: caption,
                    imageUrl: imageUrl || null,
                    timestamp: serverTimestamp(),
                    likes: [],
                    comments: []
                });
                setCaption('');
                setImageUrl('');
                setCurrentView(VIEWS.FEED);
            } catch (error) {
                console.error("Error creating post:", error);
                setErrorMessage("Failed to create post: " + error.message);
            } finally {
                setIsPosting(false);
            }
        };

        return (
            <div className="p-4 pt-8 max-w-xl mx-auto pb-16">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Create New Post</h2>
                
                {errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4" role="alert">
                        {errorMessage}
                    </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow-2xl">
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Image Preview
                        </label>
                        <div className="w-full h-64 bg-gray-200 rounded-lg overflow-hidden border-4 border-dashed border-gray-300 flex items-center justify-center">
                            {imageUrl ? (
                                <img 
                                    src={imageUrl} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                        e.target.onerror = null; 
                                        e.target.src="https://placehold.co/600x400/1e293b/94a3b8?text=Invalid+Image+URL";
                                    }}
                                />
                            ) : (
                                <span className="text-gray-500 font-medium">No Image URL</span>
                            )}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="imageUrl" className="block text-gray-700 text-sm font-bold mb-2">
                            Image URL (e.g., from Placehold.co)
                        </label>
                        <input
                            id="imageUrl"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
                            placeholder="https://placehold.co/600x400"
                            disabled={isPosting}
                        />
                    </div>
                    
                    <div className="mb-6">
                        <label htmlFor="caption" className="block text-gray-700 text-sm font-bold mb-2">
                            Caption
                        </label>
                        <textarea
                            id="caption"
                            rows="3"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
                            placeholder="Write a compelling caption..."
                            disabled={isPosting}
                        ></textarea>
                    </div>

                    <button
                        onClick={handlePost}
                        disabled={isPosting}
                        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500 focus:ring-opacity-50 transition duration-300 disabled:opacity-50 shadow-lg"
                    >
                        {isPosting ? 'Sharing...' : 'Share Post'}
                    </button>
                </div>
            </div>
        );
    };

    const MessagesView = () => {
        const [chats, setChats] = useState([]);

        useEffect(() => {
            if (!db || !userId) return;

            // Query chats where the current user is a participant
            const q = query(
                getPublicCollection(db, 'chats'),
                // For simplicity, we are still relying on client-side filtering below.
                orderBy('lastSent', 'desc'),
                limit(50) // Limit to avoid reading huge amounts of data
            );
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loadedChats = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(chat => chat.participants?.includes(userId)); // Client-side filter
                setChats(loadedChats);
            }, (error) => console.error("Error fetching chats:", error));

            return () => unsubscribe();
        }, [db, userId]);

        const handleStartChat = (targetUid) => {
            setActiveChat(targetUid);
            setCurrentView(VIEWS.CHAT_ROOM);
        };
        
        // List all users to potentially start a chat
        const chatableUsers = useMemo(() => {
            return Object.values(allUsers)
                .filter(user => user.uid !== userId && user.username);
        }, [allUsers, userId]);

        return (
            <div className="max-w-xl mx-auto p-4 pb-16">
                <h2 className="text-3xl font-semibold mb-6 text-gray-800">Direct Messages</h2>
                
                <div className="space-y-4">
                    {/* Existing Chats */}
                    {chats.length > 0 && chats.map(chat => {
                        const targetUid = chat.participants.find(uid => uid !== userId);
                        const targetUsername = chat[targetUid];
                        
                        return (
                            <div 
                                key={chat.id} 
                                className="flex items-center space-x-4 p-3 bg-white rounded-xl shadow-md border border-gray-100 cursor-pointer hover:bg-gray-50 transition"
                                onClick={() => handleStartChat(targetUid)}
                            >
                                <div className="w-10 h-10 bg-blue-300 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                    {targetUsername[0]?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold text-gray-800 truncate">{targetUsername}</p>
                                    <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    {chat.lastSent ? new Date(chat.lastSent.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'New'}
                                </span>
                            </div>
                        );
                    })}

                    {/* New Chat Starters (Users not yet chatted with) */}
                    <h3 className="text-lg font-semibold mt-8 border-t pt-4">Start New Chat</h3>
                    {chatableUsers.length > 0 ? chatableUsers.map(user => (
                        <div 
                            key={user.uid} 
                            className="flex items-center space-x-4 p-3 bg-white rounded-xl shadow-md border border-gray-100 cursor-pointer hover:bg-gray-50 transition"
                            onClick={() => handleStartChat(user.uid)}
                        >
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-bold text-lg flex-shrink-0">
                                {user.username[0]?.toUpperCase() || 'U'}
                            </div>
                            <p className="font-semibold text-gray-800 flex-grow">{user.username}</p>
                            <span className="text-sm text-indigo-500 font-medium">Message</span>
                        </div>
                    )) : (
                        <p className="text-center text-gray-500">No other users available to chat with.</p>
                    )}
                </div>
            </div>
        );
    };

    const ChatRoom = ({ targetUid, onClose }) => {
        const [messages, setMessages] = useState([]);
        const [input, setInput] = useState('');
        const chatEndRef = useRef(null);
        
        const targetUser = allUsers[targetUid];
        const chatId = getChatId(userId, targetUid);
        
        useEffect(() => {
            if (!db) return;

            const chatRef = doc(getPublicCollection(db, 'chats'), chatId);
            const messagesCollectionRef = collection(chatRef, 'messages');
            
            // Listen to messages, ordered by timestamp
            const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loadedMessages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMessages(loadedMessages);
            }, (error) => console.error("Error fetching messages:", error));

            return () => unsubscribe();
        }, [db, chatId]);

        useEffect(() => {
            // Scroll to bottom when messages load/update
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, [messages]);

        const handleSubmit = (e) => {
            e.preventDefault();
            if (input.trim()) {
                handleSendMessage(targetUid, input);
                setInput('');
            }
        };

        if (!targetUser) return <div className="p-4 text-center">User not found.</div>;
        
        return (
            <div className="flex flex-col h-screen bg-gray-50 max-w-xl mx-auto shadow-xl">
                {/* Chat Header */}
                <div className="flex items-center p-3 bg-white border-b sticky top-0 z-10 shadow-sm">
                    <BackIcon onClick={onClose} className="text-gray-600 mr-3" />
                    <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-md mr-3">
                        {targetUser.username[0]?.toUpperCase()}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">{targetUser.username}</h3>
                </div>

                {/* Messages Body */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-100">
                    {messages.map(msg => (
                        <div 
                            key={msg.id} 
                            className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-xs sm:max-w-md px-4 py-2 rounded-xl text-sm shadow-md ${
                                msg.senderId === userId 
                                    ? 'bg-blue-500 text-white rounded-br-none' 
                                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                            }`}>
                                {msg.text}
                                <span className={`block text-xs mt-1 ${msg.senderId === userId ? 'text-blue-200' : 'text-gray-400'} text-right`}>
                                    {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSubmit} className="p-3 bg-white border-t sticky bottom-0">
                    <div className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-full focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Message..."
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="px-4 py-2 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition disabled:bg-blue-300"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    const UsernameSetup = () => {
        const [username, setUsername] = useState('');
        const [bio, setBio] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
            await handleCreateProfile(username, bio);
            setIsSubmitting(false);
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-2xl">
                    <div className="flex justify-center mb-4"><InstagramLogo className="w-10 h-10 text-pink-500" /></div>
                    <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-6">Welcome to InstaClone</h2>
                    <p className="text-center text-gray-600 mb-8">Choose a username to complete your profile.</p>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {errorMessage && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl" role="alert">
                                {errorMessage}
                            </div>
                        )}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                            <input
                                id="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-pink-500 focus:border-pink-500 transition"
                                placeholder="Choose a unique name" disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Bio (Optional)</label>
                            <textarea
                                id="bio" rows="3" value={bio} onChange={(e) => setBio(e.target.value)}
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-pink-500 focus:border-pink-500 transition"
                                placeholder="Tell us about yourself" disabled={isSubmitting}
                            ></textarea>
                        </div>
                        <button
                            type="submit" disabled={isSubmitting}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-pink-500 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition disabled:opacity-50"
                        >
                            {isSubmitting ? 'Setting Up...' : 'Save Profile'}
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    const CommentModal = ({ postId, onClose }) => {
        const post = posts.find(p => p.id === postId);
        const [newCommentText, setNewCommentText] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);

        if (!post) return null;

        const handleCommentSubmit = async (e) => {
            e.preventDefault();
            if (!newCommentText.trim()) return;

            setIsSubmitting(true);
            try {
                await handleAddComment(postId, newCommentText);
                setNewCommentText('');
            } catch (error) { console.error("Comment submission failed:", error); } finally { setIsSubmitting(false); }
        };

        const sortedComments = [...(post.comments || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white rounded-2xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-xl font-semibold">Comments</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Comments List */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {sortedComments.length === 0 ? (
                            <p className="text-gray-500 text-center mt-4">No comments yet.</p>
                        ) : (
                            sortedComments.map((comment, index) => (
                                <div key={index} className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold text-gray-700">
                                        {comment.username[0]?.toUpperCase()}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-semibold text-gray-800">{comment.username}</span>
                                        <p className="text-gray-700">{comment.text}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Comment Input */}
                    <form onSubmit={handleCommentSubmit} className="p-4 border-t">
                        <div className="flex space-x-3">
                            <input
                                type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)}
                                className="flex-grow p-3 border border-gray-300 rounded-full focus:ring-pink-500 focus:border-pink-500 transition"
                                placeholder="Add a comment..." disabled={isSubmitting}
                            />
                            <button
                                type="submit" disabled={isSubmitting || !newCommentText.trim()}
                                className="px-4 py-2 bg-pink-500 text-white rounded-full font-semibold hover:bg-pink-600 transition disabled:bg-pink-300"
                            >
                                Post
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const Header = () => {
        const handleViewChange = (view) => {
            setCurrentView(view);
            setTargetUserId(null); 
            setActiveChat(null);
        }

        return (
            <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div 
                        className="text-2xl font-script text-gray-900 cursor-pointer"
                        onClick={() => handleViewChange(VIEWS.FEED)}
                    >
                        <InstagramLogo className="w-8 h-8 text-pink-500 hover:text-indigo-600 transition" />
                    </div>
                    
                    <button onClick={() => handleViewChange(VIEWS.MESSAGES)} className="text-gray-700 hover:text-pink-500 transition">
                        <MessageIcon className="rotate-45" />
                    </button>
                </div>
            </header>
        );
    };

    const BottomNav = () => {
        const items = [
            { view: VIEWS.FEED, icon: HomeIcon, label: "Home" },
            { view: VIEWS.SEARCH, icon: SearchIcon, label: "Search" },
            { view: VIEWS.CREATE, icon: PlusCircleIcon, label: "Create" },
            { view: VIEWS.PROFILE, icon: ProfileIcon, label: "Profile" }
        ];

        const handleNavClick = (view) => {
            setCurrentView(view);
            setTargetUserId(null); 
            setActiveChat(null);
            if (view === VIEWS.PROFILE) {
                 setTargetUserId(userId);
            }
        };
        
        // Helper to check if the current view should highlight the profile icon
        const isProfileActive = currentView === VIEWS.PROFILE || currentView === VIEWS.VIEW_USER;
        const isSearchActive = currentView === VIEWS.SEARCH;

        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl md:hidden">
                <div className="flex justify-around items-center h-14 max-w-xl mx-auto">
                    {items.map(item => (
                        <button
                            key={item.view}
                            onClick={() => handleNavClick(item.view)}
                            className={`flex flex-col items-center justify-center p-2 transition-colors ${
                                (item.view === VIEWS.PROFILE && isProfileActive) || 
                                (item.view === VIEWS.SEARCH && isSearchActive) ||
                                (currentView === item.view)
                                    ? 'text-pink-600' : 'text-gray-500 hover:text-pink-500'
                            }`}
                        >
                            <item.icon className={`w-6 h-6 ${item.view === VIEWS.CREATE ? 'w-8 h-8' : ''}`} />
                            <span className="text-xs font-medium sr-only">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };


    // --- Main Render Logic ---

    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="p-8 bg-white rounded-2xl shadow-xl text-pink-600 font-semibold text-lg flex items-center space-x-3">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">...</svg>
                    Loading App Data...
                </div>
            </div>
        );
    }

    if (!currentUser || !currentUser.username) {
        return <UsernameSetup />;
    }
    
    // Override rendering for ChatRoom as it's full-screen
    if (currentView === VIEWS.CHAT_ROOM && activeChat) {
        return <ChatRoom targetUid={activeChat} onClose={() => {setActiveChat(null); setCurrentView(VIEWS.MESSAGES);}} />;
    }

    const renderContent = () => {
        switch (currentView) {
            case VIEWS.FEED:
                return <PostFeed />;
            case VIEWS.CREATE:
                return <PostCreator />;
            case VIEWS.PROFILE:
                return <ProfileView uid={userId} />;
            case VIEWS.VIEW_USER:
                return <ProfileView uid={targetUserId} />;
            case VIEWS.MESSAGES:
                return <MessagesView />;
            case VIEWS.SEARCH:
                return <SearchView />;
            default:
                return <PostFeed />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />
            <main className="max-w-6xl mx-auto">
                {renderContent()}
            </main>
            <BottomNav />

            {showCommentModal && selectedPostId && (
                <CommentModal
                    postId={selectedPostId}
                    onClose={() => {
                        setShowCommentModal(false);
                        setSelectedPostId(null);
                    }}
                />
            )}
        </div>
    );
};

export default App;