import React, { useEffect, useState } from "react";
import api from "../api/api";

const Profile = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Assuming JWT is stored in localStorage
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchUser();
  }, []);

  if (!user) return <p>Loading profile...</p>;

  return (
    <div className="profile-container max-w-md mx-auto bg-white p-6 rounded-2xl shadow-lg mt-10">
      <div className="flex flex-col items-center">
        {/* Profile Picture */}
        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4">
          {user.name?.[0].toUpperCase()}
        </div>

        {/* User Info */}
        <h2 className="text-2xl font-bold mb-2">{user.name}</h2>
        <p className="text-gray-600 mb-1">{user.email}</p>
        <p className="text-gray-600 mb-1">Category: {user.category}</p>
        <p className="text-gray-600 mb-1">Country: {user.country}</p>

        {/* Optional: Points */}
        {user.points && <p className="mt-2 text-blue-500 font-semibold">Points: {user.points}</p>}

        {/* Edit Button */}
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          Edit Profile
        </button>
      </div>
    </div>
  );
};

export default Profile;
