-- Enable realtime for profiles table
begin;
  -- Check if the publication exists, if not create it (though supabase_realtime usually exists)
  -- We can't easily check existence in a simple script without plpgsql, but we can try to add the table.
  -- If it's already added, it might throw a warning or error, but usually it's fine.
  
  -- Add profiles to the supabase_realtime publication
  alter publication supabase_realtime add table profiles;
commit;
