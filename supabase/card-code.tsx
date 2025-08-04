import { useEffect, useState } from "react";
import moment from "moment";
import { supabase } from "./supabaseClient"; // replace with your actual client

const DailyPostStats = ({ userId }) => {
  const [daysData, setDaysData] = useState([]);
  const [stats, setStats] = useState({
    postedDays: 0,
    missedDays: 0,
    currentStreak: 0,
    isCurrentDayPosted: false,
    currentDay: moment().format("YYYY-MM-DD"),
  });

  useEffect(() => {
    if (userId) fetchUserPostData();
  }, [userId]);

  const fetchUserPostData = async () => {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("start_date, end_date")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error(userError);
      return;
    }

    const startDate = moment(user.start_date);
    const endDate = moment(user.end_date);
    const today = moment().format("YYYY-MM-DD");

    const dateArray = [];
    let dateCursor = startDate.clone();
    while (dateCursor.isSameOrBefore(endDate)) {
      dateArray.push(dateCursor.format("YYYY-MM-DD"));
      dateCursor.add(1, "day");
    }

    // Fetch submissions
    const { data: submissions, error: postError } = await supabase
      .from("user_post_submissions")
      .select("post_date") // Assuming you store a `post_date` field
      .eq("user_id", userId);

    if (postError) {
      console.error(postError);
      return;
    }

    const submittedDates = submissions.map((s) =>
      moment(s.post_date).format("YYYY-MM-DD")
    );

    const result = [];
    let postedDays = 0;
    let missedDays = 0;
    let currentStreak = 0;
    let streakBroken = false;
    let isCurrentDayPosted = false;

    dateArray.forEach((date) => {
      const isPosted = submittedDates.includes(date);
      if (isPosted) {
        postedDays++;
        if (!streakBroken) currentStreak++;
      } else {
        missedDays++;
        streakBroken = true;
      }

      if (date === today) {
        isCurrentDayPosted = isPosted;
      }

      result.push({
        date,
        isPosted,
        isToday: date === today,
      });
    });

    setDaysData(result);
    setStats({
      postedDays,
      missedDays,
      currentStreak,
      isCurrentDayPosted,
      currentDay: today,
    });
  };

  return (
    <div>
      <h3>Post Activity</h3>
      <ul>
        {daysData.map((day) => (
          <li key={day.date}>
            {day.date} - {day.isPosted ? "✅ Posted" : "❌ Missed"}{" "}
            {day.isToday && "(Today)"}
          </li>
        ))}
      </ul>
      <h4>Stats:</h4>
      <ul>
        <li>Posted Days: {stats.postedDays}</li>
        <li>Missed Days: {stats.missedDays}</li>
        <li>Current Streak: {stats.currentStreak}</li>
        <li>Is Today Posted? {stats.isCurrentDayPosted ? "Yes" : "No"}</li>
      </ul>
    </div>
  );
};

export default DailyPostStats;
